import { Injectable, type OnModuleInit, Logger } from '@nestjs/common';
import type { Realm } from '@prisma/client';
import { join } from 'path';
import { readdir, readFile } from 'fs/promises';

export interface ThemeColors {
  primaryColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  labelColor: string;
  inputBorderColor: string;
  inputBgColor: string;
  mutedColor: string;
}

export interface ThemeDefinition {
  name: string;
  displayName: string;
  description: string;
  colors: ThemeColors;
  css: string[];
}

export interface ThemeInfo {
  name: string;
  displayName: string;
  description: string;
  colors: ThemeColors;
}

export interface ResolvedTheme {
  primaryColor: string;
  primaryHoverColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  labelColor: string;
  inputBorderColor: string;
  inputBgColor: string;
  mutedColor: string;
  logoUrl: string;
  faviconUrl: string;
  appTitle: string;
  customCss: string;
  themeCssFiles: string[];
}

function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

@Injectable()
export class ThemeService implements OnModuleInit {
  private readonly logger = new Logger(ThemeService.name);
  private themes = new Map<string, ThemeDefinition>();
  private readonly themesDir = join(process.cwd(), 'themes');

  private readonly defaultColors: ThemeColors = {
    primaryColor: '#2563eb',
    backgroundColor: '#f0f2f5',
    cardColor: '#ffffff',
    textColor: '#1a1a2e',
    labelColor: '#374151',
    inputBorderColor: '#d1d5db',
    inputBgColor: '#ffffff',
    mutedColor: '#6b7280',
  };

  async onModuleInit() {
    await this.loadThemes();
  }

  private async loadThemes(): Promise<void> {
    try {
      const entries = await readdir(this.themesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const themeJsonPath = join(this.themesDir, entry.name, 'theme.json');
        try {
          const raw = await readFile(themeJsonPath, 'utf-8');
          const theme = JSON.parse(raw) as ThemeDefinition;
          this.themes.set(theme.name, theme);
          this.logger.log(`Loaded theme: ${theme.name} (${theme.displayName})`);
        } catch {
          this.logger.warn(`Failed to load theme from ${themeJsonPath}`);
        }
      }

      this.logger.log(`Loaded ${this.themes.size} theme(s)`);
    } catch {
      this.logger.warn(`Themes directory not found at ${this.themesDir}, using defaults`);
    }
  }

  getAvailableThemes(): ThemeInfo[] {
    return Array.from(this.themes.values()).map(({ name, displayName, description, colors }) => ({
      name,
      displayName,
      description,
      colors,
    }));
  }

  getTheme(name: string): ThemeDefinition | undefined {
    return this.themes.get(name);
  }

  resolveTheme(realm: Realm): ResolvedTheme {
    const themeName = (realm as any).themeName ?? 'authme';
    const baseTheme = this.themes.get(themeName);
    const baseColors = baseTheme?.colors ?? this.defaultColors;

    // Per-realm overrides from the theme JSON field
    const realmTheme = (realm.theme ?? {}) as Record<string, unknown>;

    const getString = (key: string, fallback: string): string => {
      const realmVal = realmTheme[key];
      if (typeof realmVal === 'string' && realmVal) return realmVal;
      return fallback;
    };

    const primaryColor = getString('primaryColor', baseColors.primaryColor);

    // Build CSS file paths for this theme
    const themeCssFiles: string[] = [];
    if (baseTheme?.css) {
      for (const cssFile of baseTheme.css) {
        themeCssFiles.push(`/themes/${themeName}/${cssFile}`);
      }
    }

    return {
      primaryColor,
      primaryHoverColor: getString('primaryHoverColor', darkenHex(primaryColor, 15)),
      backgroundColor: getString('backgroundColor', baseColors.backgroundColor),
      cardColor: getString('cardColor', baseColors.cardColor),
      textColor: getString('textColor', baseColors.textColor),
      labelColor: getString('labelColor', baseColors.labelColor),
      inputBorderColor: getString('inputBorderColor', baseColors.inputBorderColor),
      inputBgColor: getString('inputBgColor', baseColors.inputBgColor),
      mutedColor: getString('mutedColor', baseColors.mutedColor),
      logoUrl: getString('logoUrl', ''),
      faviconUrl: getString('faviconUrl', ''),
      appTitle: getString('appTitle', 'AuthMe'),
      customCss: getString('customCss', ''),
      themeCssFiles,
    };
  }
}
