import { Module } from '@nestjs/common';
import { CorsOriginService } from './cors-origin.service.js';
import { CacheModule } from '../cache/cache.module.js';

@Module({
  imports: [CacheModule],
  providers: [CorsOriginService],
  exports: [CorsOriginService],
})
export class CorsModule {}
