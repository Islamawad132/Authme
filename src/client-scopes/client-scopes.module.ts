import { Module } from '@nestjs/common';
import { ClientScopesController } from './client-scopes.controller.js';
import { ClientScopesService } from './client-scopes.service.js';

@Module({
  controllers: [ClientScopesController],
  providers: [ClientScopesService],
  exports: [ClientScopesService],
})
export class ClientScopesModule {}
