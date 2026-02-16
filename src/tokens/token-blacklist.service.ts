import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly blacklist = new Map<string, number>(); // jti -> exp timestamp
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  blacklistToken(jti: string, exp: number): void {
    this.blacklist.set(jti, exp);
  }

  isBlacklisted(jti: string): boolean {
    return this.blacklist.has(jti);
  }

  private cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of this.blacklist) {
      if (exp < now) this.blacklist.delete(jti);
    }
  }
}
