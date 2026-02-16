import type { Realm } from '@prisma/client';

export interface ThemeVars {
  primaryColor: string;
  primaryHoverColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string;
  faviconUrl: string;
  appTitle: string;
  customCss: string;
}

function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function getThemeVars(realm: Realm): ThemeVars {
  const t = (realm.theme ?? {}) as Record<string, unknown>;
  const primary = (typeof t['primaryColor'] === 'string' && t['primaryColor']) || '#2563eb';
  return {
    primaryColor: primary,
    primaryHoverColor: (typeof t['primaryHoverColor'] === 'string' && t['primaryHoverColor']) || darkenHex(primary, 15),
    backgroundColor: (typeof t['backgroundColor'] === 'string' && t['backgroundColor']) || '#f0f2f5',
    cardColor: (typeof t['cardColor'] === 'string' && t['cardColor']) || '#ffffff',
    textColor: (typeof t['textColor'] === 'string' && t['textColor']) || '#1a1a2e',
    logoUrl: (typeof t['logoUrl'] === 'string' && t['logoUrl']) || '',
    faviconUrl: (typeof t['faviconUrl'] === 'string' && t['faviconUrl']) || '',
    appTitle: (typeof t['appTitle'] === 'string' && t['appTitle']) || 'AuthMe',
    customCss: (typeof t['customCss'] === 'string' && t['customCss']) || '',
  };
}
