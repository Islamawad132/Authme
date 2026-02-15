import { Module } from '@nestjs/common';
import { RealmsController } from './realms.controller.js';
import { RealmsService } from './realms.service.js';

@Module({
  controllers: [RealmsController],
  providers: [RealmsService],
  exports: [RealmsService],
})
export class RealmsModule {}
