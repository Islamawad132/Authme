import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

export interface RedisSessionData {
  id: string;
  userId: string;
  realmId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
  [key: string]: unknown;
}

const SESSION_KEY = (sessionId: string) => `session:${sessionId}`;
const USER_SESSIONS_KEY = (realmId: string, userId: string) => `sessions:${realmId}:${userId}`;

/**
 * Redis-backed session store.
 *
 * When `SESSION_STORE=redis` and Redis is available, sessions are persisted
 * to Redis instead of (or in addition to) PostgreSQL. Each session is stored
 * as a JSON string with an expiry matching the session's `expiresAt` field.
 *
 * Falls back gracefully — if Redis is unavailable the caller should continue
 * to use the database session path.
 */
@Injectable()
export class RedisSessionService {
  private readonly logger = new Logger(RedisSessionService.name);
  private readonly enabled: boolean;

  constructor(private readonly redis: RedisService) {
    this.enabled = (process.env['SESSION_STORE'] ?? 'database') === 'redis';
    if (this.enabled) {
      this.logger.log('Redis session store enabled (SESSION_STORE=redis)');
    }
  }

  /** Returns true when the Redis session store is active and connected. */
  isActive(): boolean {
    return this.enabled && this.redis.isAvailable();
  }

  async set(session: RedisSessionData): Promise<void> {
    if (!this.isActive()) return;

    const expiresAt = new Date(session.expiresAt);
    const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    await this.redis.set(SESSION_KEY(session.id), JSON.stringify(session), ttl);

    // Track session id under user's set (with same TTL)
    const setKey = USER_SESSIONS_KEY(session.realmId, session.userId);
    await this.redis
      .get(setKey)
      .then(async (raw) => {
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!ids.includes(session.id)) {
          ids.push(session.id);
        }
        await this.redis.set(setKey, JSON.stringify(ids), ttl);
      })
      .catch((err: Error) => {
        this.logger.warn(`Could not update session index for user ${session.userId}: ${err.message}`);
      });
  }

  async get(sessionId: string): Promise<RedisSessionData | null> {
    if (!this.isActive()) return null;

    const raw = await this.redis.get(SESSION_KEY(sessionId));
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as RedisSessionData;
      if (new Date(data.expiresAt) <= new Date()) {
        await this.delete(sessionId);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.warn(`Failed to parse session ${sessionId}: ${(err as Error).message}`);
      return null;
    }
  }

  async delete(sessionId: string): Promise<void> {
    if (!this.isActive()) return;
    await this.redis.del(SESSION_KEY(sessionId));
  }

  async getUserSessions(realmId: string, userId: string): Promise<RedisSessionData[]> {
    if (!this.isActive()) return [];

    const setKey = USER_SESSIONS_KEY(realmId, userId);
    const raw = await this.redis.get(setKey);
    if (!raw) return [];

    const ids: string[] = JSON.parse(raw);
    const sessions = await Promise.all(ids.map((id) => this.get(id)));
    return sessions.filter((s): s is RedisSessionData => s !== null);
  }

  async deleteAllUserSessions(realmId: string, userId: string): Promise<void> {
    if (!this.isActive()) return;

    const setKey = USER_SESSIONS_KEY(realmId, userId);
    const raw = await this.redis.get(setKey);
    if (!raw) return;

    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map((id) => this.redis.del(SESSION_KEY(id))));
    await this.redis.del(setKey);
  }
}
