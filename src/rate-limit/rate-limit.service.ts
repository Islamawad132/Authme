import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RateLimitResult } from './rate-limit.dto.js';

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

interface RateLimitEntry {
  minute: RateLimitBucket;
  hour: RateLimitBucket;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // In-memory store: key -> { minute, hour }
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check and record rate limit for an OAuth client (token endpoint).
   */
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

  /**
   * Check and record rate limit for a user (admin API).
   */
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

  /**
   * Check and record rate limit for an IP address (login endpoints).
   */
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

  /**
   * Compute X-RateLimit-* response headers from a RateLimitResult.
   */
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

  /**
   * Core sliding-window rate limit check (per-minute takes precedence over per-hour).
   * Returns the tighter of the two windows.
   */
  private check(key: string, limitPerMinute: number, limitPerHour: number): RateLimitResult {
    const now = Date.now();
    const minuteWindowMs = 60_000;
    const hourWindowMs = 3_600_000;

    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        minute: { count: 0, windowStart: now },
        hour: { count: 0, windowStart: now },
      };
    }

    // Reset windows if expired
    if (now - entry.minute.windowStart >= minuteWindowMs) {
      entry.minute = { count: 0, windowStart: now };
    }
    if (now - entry.hour.windowStart >= hourWindowMs) {
      entry.hour = { count: 0, windowStart: now };
    }

    // Increment counters
    entry.minute.count += 1;
    entry.hour.count += 1;
    this.store.set(key, entry);

    const minuteResetAt = Math.ceil((entry.minute.windowStart + minuteWindowMs) / 1000);
    const hourResetAt = Math.ceil((entry.hour.windowStart + hourWindowMs) / 1000);

    // Check minute limit first (more restrictive)
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

    // Check hour limit
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

    // Return the tighter remaining (minute-window info is most relevant)
    const minuteRemaining = limitPerMinute - entry.minute.count;
    return {
      allowed: true,
      limit: limitPerMinute,
      remaining: minuteRemaining,
      resetAt: minuteResetAt,
    };
  }

  /**
   * Periodic cleanup of expired in-memory entries to prevent unbounded growth.
   * Runs every 10 minutes.
   */
  @Interval(600_000)
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const hourWindowMs = 3_600_000;
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (
        now - entry.minute.windowStart > hourWindowMs &&
        now - entry.hour.windowStart > hourWindowMs
      ) {
        this.store.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired rate limit entries`);
    }
  }
}
