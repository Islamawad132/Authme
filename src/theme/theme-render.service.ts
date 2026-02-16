import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { Realm } from '@prisma/client';
import { ThemeService } from './theme.service.js';
import { ThemeTemplateService } from './theme-template.service.js';
import { ThemeMessageService } from './theme-message.service.js';
import type { ThemeType } from './theme.types.js';

@Injectable()
export class ThemeRenderService {
  constructor(
    private readonly themeService: ThemeService,
    private readonly templateService: ThemeTemplateService,
    private readonly messageService: ThemeMessageService,
  ) {}

  /**
   * Renders a themed page. Replaces @Render() decorator and direct res.render() calls.
   *
   * @param res - Express response object
   * @param realm - The current realm
   * @param themeType - Theme type: 'login', 'account', or 'email'
   * @param templateName - Template name without extension (e.g., "login", "account")
   * @param data - Page-specific template data (form fields, errors, etc.)
   */
  render(
    res: Response,
    realm: Realm,
    themeType: ThemeType,
    templateName: string,
    data: Record<string, any>,
  ): void {
    const themeName = this.themeService.getRealmThemeName(realm, themeType);
    const templatePath = this.templateService.resolve(themeName, themeType, templateName);
    const layoutPath = this.templateService.resolve(themeName, themeType, 'layouts/main');
    const colors = this.themeService.resolveColors(themeName, realm);
    const messages = this.messageService.getMessages(themeName, themeType, 'en');
    const cssFiles = this.themeService.resolveCss(themeName, themeType);

    res.render(templatePath, {
      layout: layoutPath,
      ...data,
      ...colors,
      _messages: messages,
      themeCssFiles: cssFiles,
      realmName: data.realmName ?? realm.name,
      realmDisplayName: data.realmDisplayName ?? realm.displayName ?? realm.name,
    });
  }
}
