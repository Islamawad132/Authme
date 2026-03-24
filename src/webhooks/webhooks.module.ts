import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookSchedulerService } from './webhook-scheduler.service.js';

@Module({
  imports: [CryptoModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSchedulerService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
