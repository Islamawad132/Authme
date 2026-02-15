import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
