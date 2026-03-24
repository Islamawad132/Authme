import { Global, Module, forwardRef } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { EventsCleanupService } from './events-cleanup.service.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';

@Global()
@Module({
  imports: [forwardRef(() => WebhooksModule)],
  controllers: [EventsController],
  providers: [EventsService, EventsCleanupService],
  exports: [EventsService],
})
export class EventsModule {}
