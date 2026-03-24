import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DeprecationInterceptor } from './deprecation.interceptor.js';
import { MigrationCheckService } from './migration-check.service.js';
import { SystemVersionController } from './system-version.controller.js';

@Module({
  controllers: [SystemVersionController],
  providers: [
    MigrationCheckService,
    {
      provide: APP_INTERCEPTOR,
      useClass: DeprecationInterceptor,
    },
  ],
  exports: [MigrationCheckService],
})
export class VersioningModule {}
