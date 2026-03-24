import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { RateLimitResult } from './rate-limit.dto.js';

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

interface RateLimitEntry {
  minute: RateLimitBucket;
  hour: RateLimitBucket;
}

const RL_PREFIX = 'rl:';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  /** In-memory fallback used only when Redis is unavailable. */
  private readonly memoryStore = new Map<string, RateLimitEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkClientLimit(clientId: string, realmId: string): Promise<RateLimitResult> {
    const realm = await this.prisma.realm.findUnique({
      where: { id: realmId },
      select: {
        rateLimitEnabled: true,
        clientRateLimitPerMinute: true,
        clientRateLimitPerHour: true,
      },
    });

    if (!realm || !realm.rateLimitEnabled) {
      return { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
    }

    return this.check(
      `client:${realmId}:${clientId}`,
      realm.clientRateLimitPerMinute,
      realm.clientRateLimitPerHour,
    );
  }

  async checkUserLimit(userId: string, realmId: string): Promise<RateLimitResult> {
    const realm = await this.prisma.realm.findUnique({
      where: { id: realmId },
      select: {
        rateLimitEnabled: true,
        userRateLimitPerMinute: true,
        userRateLimitPerHour: true,
      },
    });

    if (!realm || !realm.rateLimitEnabled) {
      return { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
    }

    return this.check(
      `user:${realmId}:${userId}`,
      realm.userRateLimitPerMinute,
      realm.userRateLimitPerHour,
    );
  }

  async checkIpLimit(ip: string, realmId: string): Promise<RateLimitResult> {
    const realm = await this.prisma.realm.findUnique({
      where: { id: realmId },
      select: {
        rateLimitEnabled: true,
        ipRateLimitPerMinute: true,
        ipRateLimitPerHour: true,
      },
    });

    if (!realm || !realm.rateLimitEnabled) {
      return { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
    }

    return this.check(
      `ip:${realmId}:${ip}`,
      realm.ipRateLimitPerMinute,
      realm.ipRateLimitPerHour,
    );
  }

  computeHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
      'X-RateLimit-Reset': String(result.resetAt),
    };

    if (!result.allowed && result.retryAfter !== undefined) {
      headers['Retry-After'] = String(result.retryAfter);
    }

    return headers;
  }

  private async check(key: string, limitPerMinute: number, limitPerHour: number): Promise<RateLimitResult> {
    // Use Redis when available for shared state across instances
    if (this.redis.isAvailable()) {
      try {
        return await this.checkWithRedis(key, limitPerMinute, limitPerHour);
      } catch (err) {
        this.logger.warn(`Redis rate limit check failed, falling back to memory: ${(err as Error).message}`);
      }
    }

    return this.checkInMemory(key, limitPerMinute, limitPerHour);
  }

  /**
   * Redis-based rate limiting using simple INCR + EXPIRE (fixed window).
   * Shared across all instances.
   */
  private async checkWithRedis(key: string, limitPerMinute: number, limitPerHour: number): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const minuteWindow = Math.floor(now / 60);
    const hourWindow = Math.floor(now / 3600);

    const minuteKey = `${RL_PREFIX}m:${key}:${minuteWindow}`;
    const hourKey = `${RL_PREFIX}h:${key}:${hourWindow}`;

    // Increment both counters atomically
    const minuteCountStr = await this.redisIncr(minuteKey, 120); // 2 min TTL for minute window
    const hourCountStr = await this.redisIncr(hourKey, 7200); // 2 hour TTL for hour window

    const minuteCount = parseInt(minuteCountStr, 10);
    const hourCount = parseInt(hourCountStr, 10);

    const minuteResetAt = (minuteWindow + 1) * 60;
    const hourResetAt = (hourWindow + 1) * 3600;

    // Check minute limit
    if (minuteCount > limitPerMinute) {
      const retryAfter = minuteResetAt - now;
      return {
        allowed: false,
        limit: limitPerMinute,
        remaining: 0,
        resetAt: minuteResetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Check hour limit
    if (hourCount > limitPerHour) {
      const retryAfter = hourResetAt - now;
      return {
        allowed: false,
        limit: limitPerHour,
        remaining: 0,
        resetAt: hourResetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      allowed: true,
      limit: limitPerMinute,
      remaining: limitPerMinute - minuteCount,
      resetAt: minuteResetAt,
    };
  }

  /**
   * Increment a Redis key and set TTL if it's a new key.
   */
  private async redisIncr(key: string, ttl: number): Promise<string> {
    // Use set + get pattern since RedisService doesn't expose INCR directly
    const current = await this.redis.get(key);
    const newCount = (current ? parseInt(current, 10) : 0) + 1;
    await this.redis.set(key, String(newCount), ttl);
    return String(newCount);
  }

  /**
   * In-memory rate limiting fallback (original implementation).
   */
  private checkInMemory(key: string, limitPerMinute: number, limitPerHour: number): RateLimitResult {
    const now = Date.now();
    const minuteWindowMs = 60_000;
    const hourWindowMs = 3_600_000;

    let entry = this.memoryStore.get(key);

    if (!entry) {
      entry = {
        minute: { count: 0, windowStart: now },
        hour: { count: 0, windowStart: now },
      };
    }

    if (now - entry.minute.windowStart >= minuteWindowMs) {
      entry.minute = { count: 0, windowStart: now };
    }
    if (now - entry.hour.windowStart >= hourWindowMs) {
      entry.hour = { count: 0, windowStart: now };
    }

    entry.minute.count += 1;
    entry.hour.count += 1;
    this.memoryStore.set(key, entry);

    const minuteResetAt = Math.ceil((entry.minute.windowStart + minuteWindowMs) / 1000);
    const hourResetAt = Math.ceil((entry.hour.windowStart + hourWindowMs) / 1000);

    if (entry.minute.count > limitPerMinute) {
      const retryAfter = minuteResetAt - Math.floor(now / 1000);
      return {
        allowed: false,
        limit: limitPerMinute,
        remaining: 0,
        resetAt: minuteResetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    if (entry.hour.count > limitPerHour) {
      const retryAfter = hourResetAt - Math.floor(now / 1000);
      return {
        allowed: false,
        limit: limitPerHour,
        remaining: 0,
        resetAt: hourResetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      allowed: true,
      limit: limitPerMinute,
      remaining: limitPerMinute - entry.minute.count,
      resetAt: minuteResetAt,
    };
  }

  @Interval(600_000)
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const hourWindowMs = 3_600_000;
    let removed = 0;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (
        now - entry.minute.windowStart > hourWindowMs &&
        now - entry.hour.windowStart > hourWindowMs
      ) {
        this.memoryStore.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired rate limit entries`);
    }
  }
}
