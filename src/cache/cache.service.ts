import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

const KEY = {
  realm: (realmId: string) => `realm:config:${realmId}`,
  realmByName: (name: string) => `realm:name:${name}`,
  client: (clientId: string) => `client:config:${clientId}`,
  jwks: (realmId: string) => `realm:jwks:${realmId}`,
} as const;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  // ─── Realm ───────────────────────────────────────────────────────────────

  async cacheRealmConfig(realmId: string, config: object, ttl = 300): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.set(KEY.realm(realmId), JSON.stringify(config), ttl);
  }

  async getCachedRealmConfig<T = unknown>(realmId: string): Promise<T | null> {
    return this.getJson<T>(KEY.realm(realmId), 'realm_config');
  }

  async cacheRealmByName(name: string, config: object, ttl = 300): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.set(KEY.realmByName(name), JSON.stringify(config), ttl);
  }

  async getCachedRealmByName<T = unknown>(name: string): Promise<T | null> {
    return this.getJson<T>(KEY.realmByName(name), 'realm_by_name');
  }

  async invalidateRealmCache(realmId: string, realmName?: string): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await Promise.all([
      this.redis.del(KEY.realm(realmId)),
      this.redis.del(KEY.jwks(realmId)),
      ...(realmName ? [this.redis.del(KEY.realmByName(realmName))] : []),
    ]);
    this.logger.debug(`Invalidated cache for realm ${realmId}`);
  }

  // ─── Client ──────────────────────────────────────────────────────────────

  async cacheClientConfig(clientId: string, config: object, ttl = 300): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.set(KEY.client(clientId), JSON.stringify(config), ttl);
  }

  async getCachedClientConfig<T = unknown>(clientId: string): Promise<T | null> {
    return this.getJson<T>(KEY.client(clientId), 'client_config');
  }

  async invalidateClientCache(clientId: string): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.del(KEY.client(clientId));
    this.logger.debug(`Invalidated cache for client ${clientId}`);
  }

  // ─── JWKS ────────────────────────────────────────────────────────────────

  async cacheJWKS(realmId: string, jwks: object, ttl = 600): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.set(KEY.jwks(realmId), JSON.stringify(jwks), ttl);
  }

  async getCachedJWKS<T = unknown>(realmId: string): Promise<T | null> {
    return this.getJson<T>(KEY.jwks(realmId), 'jwks');
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private async getJson<T>(key: string, metricLabel: string): Promise<T | null> {
    if (!this.redis.isAvailable()) return null;

    const raw = await this.redis.get(key);
    const hit = raw !== null;

    this.metrics.cacheOperationsTotal.inc({ operation: hit ? 'hit' : 'miss', cache: metricLabel });

    if (!hit) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Failed to parse cached value for key ${key}: ${(err as Error).message}`);
      return null;
    }
  }
}
