import { Global, Module } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminSeedService } from './admin-seed.service.js';

@Global()
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminSeedService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
