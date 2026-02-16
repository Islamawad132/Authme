import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { EventsCleanupService } from './events-cleanup.service.js';

@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsCleanupService],
  exports: [EventsService],
})
export class EventsModule {}
