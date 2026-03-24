import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitInterceptor } from './rate-limit.interceptor.js';

@Global()
@Module({
  providers: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
  exports: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
})
export class RateLimitModule {}
