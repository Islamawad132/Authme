import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { CacheModule } from '../cache/cache.module.js';
import { CorsModule } from '../cors/cors.module.js';

@Module({
  imports: [CacheModule, CorsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
