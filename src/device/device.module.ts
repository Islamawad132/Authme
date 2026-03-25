import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller.js';
import { DeviceService } from './device.service.js';
import { ThemeModule } from '../theme/theme.module.js';
import { CsrfService } from '../common/csrf/csrf.service.js';

@Module({
  imports: [ThemeModule],
  controllers: [DeviceController],
  providers: [DeviceService, CsrfService],
  exports: [DeviceService],
})
export class DeviceModule {}
