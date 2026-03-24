import { Injectable } from '@nestjs/common';
import { relative } from 'path';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { ThemeService } from './theme.service.js';
import { ThemeTemplateService } from './theme-template.service.js';
import { ThemeMessageService } from './theme-message.service.js';
import { I18nService, SUPPORTED_LOCALES } from './i18n.service.js';
import type { ThemeType } from './theme.types.js';

@Injectable()
export class ThemeRenderService {
  constructor(
    private readonly themeService: ThemeService,
    private readonly templateService: ThemeTemplateService,
    private readonly messageService: ThemeMessageService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Renders a themed page. Replaces @Render() decorator and direct res.render() calls.
   *
   * @param res - Express response object
   * @param realm - The current realm
   * @param themeType - Theme type: 'login', 'account', or 'email'
   * @param templateName - Template name without extension (e.g., "login", "account")
   * @param data - Page-specific template data (form fields, errors, etc.)
   * @param req - Optional Express request object used to detect locale from
   *              Accept-Language header or `?lang=` query parameter.
   */
  render(
    res: Response,
    realm: Realm,
    themeType: ThemeType,
    templateName: string,
    data: Record<string, any>,
    req?: Request,
  ): void {
    const themeName = this.themeService.getRealmThemeName(realm, themeType);
    const templatePath = this.templateService.resolve(themeName, themeType, templateName);
    const layoutPath = this.templateService.resolve(themeName, themeType, 'layouts/main');
    const colors = this.themeService.resolveColors(themeName, realm);
    const cssFiles = this.themeService.resolveCss(themeName, themeType);

    // Resolve locale: prefer request-based detection, fall back to realm default, then 'en'
    const locale = req
      ? this.i18n.detectLocale(req)
      : ((realm as any).defaultLocale ?? 'en');
    const messages = this.messageService.getMessages(themeName, themeType, locale);
    const isRtl = this.i18n.isRtl(locale);

    // Convert absolute paths to relative (relative to themes dir) for Express view resolution
    const themesDir = this.themeService.getThemesDir();
    const relativeTemplate = relative(themesDir, templatePath);
    const relativeLayout = relative(themesDir, layoutPath);

    // Build the language switcher data: list of supported locales for the dropdown
    const currentUrl = req ? this.buildCurrentUrl(req) : '';
    const languageSwitcher = SUPPORTED_LOCALES.map((code) => ({
      code,
      label: this.getLocaleLabel(code),
      active: code === locale,
      url: this.buildLangUrl(currentUrl, code),
    }));

    res.render(relativeTemplate, {
      layout: relativeLayout,
      ...data,
      ...colors,
      _messages: messages,
      themeCssFiles: cssFiles,
      realmName: data.realmName ?? realm.name,
      realmDisplayName: data.realmDisplayName ?? realm.displayName ?? realm.name,
      // i18n context
      locale,
      isRtl,
      dir: isRtl ? 'rtl' : 'ltr',
      languageSwitcher,
      currentLangLabel: this.getLocaleLabel(locale),
    });
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Returns the full URL of the current request (path + existing query params).
   */
  private buildCurrentUrl(req: Request): string {
    return req.originalUrl ?? req.url ?? '';
  }

  /**
   * Builds a URL that sets the `lang` query parameter to the given locale,
   * preserving all other existing query params.
   */
  private buildLangUrl(currentUrl: string, locale: string): string {
    try {
      // Use a fake base so URL can parse a path-only string
      const base = 'http://x';
      const url = new URL(currentUrl, base);
      url.searchParams.set('lang', locale);
      return url.pathname + url.search;
    } catch {
      // Fallback: append ?lang=XX
      const separator = currentUrl.includes('?') ? '&' : '?';
      return `${currentUrl}${separator}lang=${locale}`;
    }
  }

  /**
   * Returns a human-readable label for a locale code.
   */
  private getLocaleLabel(locale: string): string {
    const labels: Record<string, string> = {
      en: 'English',
      es: 'Espanol',
      fr: 'Francais',
      de: 'Deutsch',
      pt: 'Portugues',
      zh: '\u4e2d\u6587',
      ja: '\u65e5\u672c\u8a9e',
      ko: '\ud55c\uad6d\uc5b4',
      ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
      ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
    };
    return labels[locale] ?? locale;
  }
}
