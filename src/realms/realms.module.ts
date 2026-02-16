import { Module } from '@nestjs/common';
import { RealmsController } from './realms.controller.js';
import { RealmsService } from './realms.service.js';
import { RealmExportService } from './realm-export.service.js';
import { RealmImportService } from './realm-import.service.js';
import { ThemeModule } from '../theme/theme.module.js';

@Module({
  imports: [ThemeModule],
  controllers: [RealmsController],
  providers: [RealmsService, RealmExportService, RealmImportService],
  exports: [RealmsService],
})
export class RealmsModule {}
