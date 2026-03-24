import { I18nService, SUPPORTED_LOCALES } from './i18n.service.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  // ─── detectLocale ────────────────────────────────────────

  describe('detectLocale', () => {
    it('should use lang query param when present and valid', () => {
      const req = { query: { lang: 'fr' }, headers: {} } as any;
      expect(service.detectLocale(req)).toBe('fr');
    });

    it('should normalize lang query param (e.g., "FR" → "fr")', () => {
      const req = { query: { lang: 'FR' }, headers: {} } as any;
      expect(service.detectLocale(req)).toBe('fr');
    });

    it('should normalise region-subtag lang param (e.g., "fr-FR" → "fr")', () => {
      const req = { query: { lang: 'fr-FR' }, headers: {} } as any;
      expect(service.detectLocale(req)).toBe('fr');
    });

    it('should ignore unsupported lang query param and fall back to Accept-Language', () => {
      const req = {
        query: { lang: 'xx' },
        headers: { 'accept-language': 'de' },
      } as any;
      expect(service.detectLocale(req)).toBe('de');
    });

    it('should use Accept-Language header when no lang param', () => {
      const req = {
        query: {},
        headers: { 'accept-language': 'ja,en;q=0.8' },
      } as any;
      expect(service.detectLocale(req)).toBe('ja');
    });

    it('should honour quality factor ordering in Accept-Language', () => {
      const req = {
        query: {},
        headers: { 'accept-language': 'en;q=0.5,de;q=0.9,fr;q=0.7' },
      } as any;
      expect(service.detectLocale(req)).toBe('de');
    });

    it('should fall back to "en" when no matching locale is found', () => {
      const req = {
        query: {},
        headers: { 'accept-language': 'tlh' }, // Klingon - unsupported
      } as any;
      expect(service.detectLocale(req)).toBe('en');
    });

    it('should fall back to "en" when there is no request context', () => {
      const req = { query: {}, headers: {} } as any;
      expect(service.detectLocale(req)).toBe('en');
    });

    it('should skip unsupported tags and pick the first supported one', () => {
      const req = {
        query: {},
        headers: { 'accept-language': 'xx,yy;q=0.9,ko;q=0.8' },
      } as any;
      expect(service.detectLocale(req)).toBe('ko');
    });
  });

  // ─── isRtl ───────────────────────────────────────────────

  describe('isRtl', () => {
    it('should return true for Arabic ("ar")', () => {
      expect(service.isRtl('ar')).toBe(true);
    });

    it('should return false for English ("en")', () => {
      expect(service.isRtl('en')).toBe(false);
    });

    it('should return false for Spanish ("es")', () => {
      expect(service.isRtl('es')).toBe(false);
    });

    it('should return false for an unknown locale', () => {
      expect(service.isRtl('xx')).toBe(false);
    });
  });

  // ─── getSupportedLocales ─────────────────────────────────

  describe('getSupportedLocales', () => {
    it('should return all 10 supported locales', () => {
      const locales = service.getSupportedLocales();
      expect(locales).toHaveLength(10);
      expect(locales).toContain('en');
      expect(locales).toContain('ar');
      expect(locales).toContain('zh');
    });

    it('should match SUPPORTED_LOCALES constant', () => {
      expect(service.getSupportedLocales()).toEqual(SUPPORTED_LOCALES);
    });
  });

  // ─── normalizeLocale ─────────────────────────────────────

  describe('normalizeLocale', () => {
    it('should return the locale for an exact match', () => {
      expect(service.normalizeLocale('fr')).toBe('fr');
    });

    it('should normalise uppercase to lowercase', () => {
      expect(service.normalizeLocale('DE')).toBe('de');
    });

    it('should extract base language from a region tag', () => {
      expect(service.normalizeLocale('zh-CN')).toBe('zh');
      expect(service.normalizeLocale('pt-BR')).toBe('pt');
    });

    it('should return null for an unsupported locale', () => {
      expect(service.normalizeLocale('xx')).toBeNull();
    });

    it('should return null for an empty string', () => {
      expect(service.normalizeLocale('')).toBeNull();
    });

    it('should handle underscore region separator (e.g., "ja_JP")', () => {
      expect(service.normalizeLocale('ja_JP')).toBe('ja');
    });
  });

  // ─── parseAcceptLanguage ─────────────────────────────────

  describe('parseAcceptLanguage', () => {
    it('should parse a simple single locale', () => {
      expect(service.parseAcceptLanguage('en')).toEqual(['en']);
    });

    it('should parse multiple locales ordered by q-factor', () => {
      const result = service.parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8');
      expect(result).toEqual(['fr-FR', 'fr', 'en']);
    });

    it('should treat missing q-factor as 1.0', () => {
      const result = service.parseAcceptLanguage('de,fr;q=0.7');
      expect(result[0]).toBe('de');
      expect(result[1]).toBe('fr');
    });

    it('should sort by quality descending', () => {
      const result = service.parseAcceptLanguage('en;q=0.1,ar;q=0.9,ko;q=0.5');
      expect(result).toEqual(['ar', 'ko', 'en']);
    });

    it('should handle a header with only spaces around commas', () => {
      const result = service.parseAcceptLanguage('en , fr;q=0.8');
      expect(result).toContain('en');
      expect(result).toContain('fr');
    });

    it('should return an empty array for an empty string', () => {
      expect(service.parseAcceptLanguage('')).toEqual([]);
    });
  });
});
