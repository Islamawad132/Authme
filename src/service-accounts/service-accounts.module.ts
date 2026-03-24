import { Module } from '@nestjs/common';
import { ServiceAccountsController } from './service-accounts.controller.js';
import { ServiceAccountsService } from './service-accounts.service.js';
import { ApiKeyGuard } from './api-key.guard.js';

@Module({
  controllers: [ServiceAccountsController],
  providers: [ServiceAccountsService, ApiKeyGuard],
  exports: [ServiceAccountsService, ApiKeyGuard],
})
export class ServiceAccountsModule {}
