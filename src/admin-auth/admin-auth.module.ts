import { Global, Module } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminSeedService } from './admin-seed.service.js';
import { AdminRolesGuard } from '../common/guards/admin-roles.guard.js';

@Global()
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminSeedService, AdminRolesGuard],
  exports: [AdminAuthService, AdminRolesGuard],
})
export class AdminAuthModule {}
