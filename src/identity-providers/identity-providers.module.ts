import { Module } from '@nestjs/common';
import { IdentityProvidersController } from './identity-providers.controller.js';
import { IdentityProvidersService } from './identity-providers.service.js';

@Module({
  controllers: [IdentityProvidersController],
  providers: [IdentityProvidersService],
  exports: [IdentityProvidersService],
})
export class IdentityProvidersModule {}
