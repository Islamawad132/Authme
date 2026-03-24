import { Module } from '@nestjs/common';
import { StatsService } from './stats.service.js';
import { StatsController } from './stats.controller.js';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
