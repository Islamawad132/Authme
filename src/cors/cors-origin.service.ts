import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../cache/cache.service.js';

/**
 * CorsOriginService
 *
 * Centralises the "is this Origin allowed?" check that the CORS middleware runs
 * on every cross-origin request.  Without caching each request triggered a DB
 * query (findFirst on the client table), making CORS a performance bottleneck.
 *
 * Strategy (two-level cache, fast → slow):
 *
 *  1. In-process Set<string>  — zero-latency; rebuilt from level 2 on miss.
 *  2. Redis (via CacheService) — survives process restarts; TTL 300 s.
 *  3. Prisma (database)       — authoritative; only consulted on Redis miss.
 *
 * Invalidation:
 *   Call invalidate() whenever a client's webOrigins or enabled flag changes.
 *   ClientsService already calls cache.invalidateCorsOrigins(); that in turn
 *   clears Redis and sets localCacheExpiry = 0 so the next request reloads.
 */
@Injectable()
export class CorsOriginService {
  private readonly logger = new Logger(CorsOriginService.name);

  /** In-process cache: set of allowed origins (includes '*' sentinel when present). */
  private localOrigins: Set<string> | null = null;
  /** Epoch ms at which the in-process cache expires. */
  private localCacheExpiry = 0;
  /** Local TTL in ms (5 minutes — mirrors the Redis TTL). */
  private readonly LOCAL_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Returns true if the given origin is permitted by at least one enabled client.
   * The empty / undefined origin (same-origin, server-to-server) must be handled
   * by the caller — this method always expects a non-empty string.
   */
  async isOriginAllowed(origin: string): Promise<boolean> {
    const origins = await this.getAllowedOrigins();

    // Wildcard: any origin is permitted
    if (origins.has('*')) return true;

    return origins.has(origin);
  }

  /**
   * Drop both caches so the next call reloads from the database.
   * Called automatically by CacheService.invalidateCorsOrigins() via ClientsService.
   */
  invalidateLocalCache(): void {
    this.localOrigins = null;
    this.localCacheExpiry = 0;
    this.logger.debug('In-process CORS origin cache invalidated');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getAllowedOrigins(): Promise<Set<string>> {
    const now = Date.now();

    // 1. In-process cache hit
    if (this.localOrigins !== null && now < this.localCacheExpiry) {
      return this.localOrigins;
    }

    // 2. Redis cache hit
    const redisOrigins = await this.cache.getCachedCorsOrigins();
    if (redisOrigins !== null) {
      this.localOrigins = new Set(redisOrigins);
      this.localCacheExpiry = now + this.LOCAL_TTL_MS;
      return this.localOrigins;
    }

    // 3. Database (cache miss)
    return this.loadFromDatabase();
  }

  private async loadFromDatabase(): Promise<Set<string>> {
    this.logger.debug('CORS origin cache miss — loading from database');

    try {
      const clients = await this.prisma.client.findMany({
        where: { enabled: true },
        select: { webOrigins: true },
      });

      const origins = new Set<string>();
      for (const client of clients) {
        for (const o of client.webOrigins) {
          origins.add(o);
        }
      }

      const originArray = Array.from(origins);

      // Populate both cache levels
      await this.cache.cacheCorsOrigins(originArray);

      this.localOrigins = origins;
      this.localCacheExpiry = Date.now() + this.LOCAL_TTL_MS;

      return origins;
    } catch (err) {
      this.logger.error(
        `Failed to load CORS origins from database: ${(err as Error).message}`,
      );
      // Return an empty set on error — the CORS callback will deny the request.
      return new Set<string>();
    }
  }
}
