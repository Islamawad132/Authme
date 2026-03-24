import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { RedisHealthIndicator } from './redis.health.js';

@Global()
@Module({
  providers: [RedisService, RedisHealthIndicator],
  exports: [RedisService, RedisHealthIndicator],
})
export class RedisModule {}
