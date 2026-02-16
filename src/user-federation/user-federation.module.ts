import { Module } from '@nestjs/common';
import { UserFederationController } from './user-federation.controller.js';
import { UserFederationService } from './user-federation.service.js';

@Module({
  controllers: [UserFederationController],
  providers: [UserFederationService],
  exports: [UserFederationService],
})
export class UserFederationModule {}
