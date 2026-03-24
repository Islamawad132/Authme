import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
import { CacheModule } from '../cache/cache.module.js';

@Module({
  imports: [CacheModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
