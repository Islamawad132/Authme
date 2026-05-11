import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service.js';
import { ThemePreviewService } from './theme-preview.service.js';
import { ThemeTemplateService } from './theme-template.service.js';
import { ThemeMessageService } from './theme-message.service.js';
import { ThemeRenderService } from './theme-render.service.js';
import { ThemeEmailService } from './theme-email.service.js';
import { ThemeUploadService } from './theme-upload.service.js';
import { I18nService } from './i18n.service.js';
import { ThemeController } from './theme.controller.js';

@Module({
  controllers: [ThemeController],
  providers: [
    ThemeService,
    ThemePreviewService,
    ThemeTemplateService,
    ThemeMessageService,
    ThemeRenderService,
    ThemeEmailService,
    ThemeUploadService,
    I18nService,
  ],
  exports: [
    ThemeService,
    ThemePreviewService,
    ThemeTemplateService,
    ThemeMessageService,
    ThemeRenderService,
    ThemeEmailService,
    ThemeUploadService,
    I18nService,
  ],
})
export class ThemeModule {}
