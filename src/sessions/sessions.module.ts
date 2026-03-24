import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsCleanupService } from './sessions-cleanup.service.js';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionsCleanupService],
  exports: [SessionsService],
})
export class SessionsModule {}
