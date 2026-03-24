import { Module } from '@nestjs/common';
import { WellKnownController } from './well-known.controller.js';
import { CacheModule } from '../cache/cache.module.js';

@Module({
  imports: [CacheModule],
  controllers: [WellKnownController],
})
export class WellKnownModule {}
