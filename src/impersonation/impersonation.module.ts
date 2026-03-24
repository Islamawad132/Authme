import { Module } from '@nestjs/common';
import { ImpersonationController } from './impersonation.controller.js';
import { ImpersonationService } from './impersonation.service.js';

@Module({
  controllers: [ImpersonationController],
  providers: [ImpersonationService],
  exports: [ImpersonationService],
})
export class ImpersonationModule {}
