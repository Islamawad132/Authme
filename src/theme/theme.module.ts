import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service.js';
import { ThemeTemplateService } from './theme-template.service.js';
import { ThemeMessageService } from './theme-message.service.js';
import { ThemeRenderService } from './theme-render.service.js';
import { ThemeEmailService } from './theme-email.service.js';

@Module({
  providers: [
    ThemeService,
    ThemeTemplateService,
    ThemeMessageService,
    ThemeRenderService,
    ThemeEmailService,
  ],
  exports: [
    ThemeService,
    ThemeTemplateService,
    ThemeMessageService,
    ThemeRenderService,
    ThemeEmailService,
  ],
})
export class ThemeModule {}
