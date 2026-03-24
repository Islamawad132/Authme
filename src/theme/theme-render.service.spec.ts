import { ThemeRenderService } from './theme-render.service.js';

describe('ThemeRenderService', () => {
  let service: ThemeRenderService;
  let themeService: {
    getRealmThemeName: jest.Mock;
    getThemesDir: jest.Mock;
    resolveColors: jest.Mock;
    resolveCss: jest.Mock;
  };
  let templateService: {
    resolve: jest.Mock;
  };
  let messageService: {
    getMessages: jest.Mock;
  };
  let i18nService: {
    detectLocale: jest.Mock;
    isRtl: jest.Mock;
  };

  const mockRealm = {
    name: 'test-realm',
    displayName: 'Test Realm',
    theme: {},
    defaultLocale: 'en',
  } as any;

  let mockRes: { render: jest.Mock };
  let mockReq: { query: Record<string, string>; headers: Record<string, string> };

  beforeEach(() => {
    themeService = {
      getRealmThemeName: jest.fn().mockReturnValue('authme'),
      getThemesDir: jest.fn().mockReturnValue('/app/themes'),
      resolveColors: jest.fn().mockReturnValue({
        primaryColor: '#2563eb',
        backgroundColor: '#f0f2f5',
      }),
      resolveCss: jest.fn().mockReturnValue(['/themes/authme/login/resources/styles.css']),
    };
    templateService = {
      resolve: jest.fn()
        .mockReturnValueOnce('/app/themes/authme/login/templates/login.hbs')
        .mockReturnValueOnce('/app/themes/authme/login/templates/layouts/main.hbs'),
    };
    messageService = {
      getMessages: jest.fn().mockReturnValue({ loginTitle: 'Sign In' }),
    };
    i18nService = {
      detectLocale: jest.fn().mockReturnValue('en'),
      isRtl: jest.fn().mockReturnValue(false),
    };

    service = new ThemeRenderService(
      themeService as any,
      templateService as any,
      messageService as any,
      i18nService as any,
    );

    mockRes = { render: jest.fn() };
    mockReq = { query: {}, headers: {} } as any;
  });

  describe('render', () => {
    it('should call res.render with correct template and data', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {
        formAction: '/login',
      }, mockReq as any);

      expect(mockRes.render).toHaveBeenCalledTimes(1);

      const [template, data] = mockRes.render.mock.calls[0];

      // Template should be relative to themes dir
      expect(template).toMatch(/authme[/\\]login[/\\]templates[/\\]login\.hbs/);

      // Data should include merged colors, messages, and page data
      expect(data.formAction).toBe('/login');
      expect(data.primaryColor).toBe('#2563eb');
      expect(data._messages).toEqual({ loginTitle: 'Sign In' });
      expect(data.themeCssFiles).toEqual(['/themes/authme/login/resources/styles.css']);
      expect(data.realmName).toBe('test-realm');
      expect(data.realmDisplayName).toBe('Test Realm');
    });

    it('should resolve theme name from realm', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      expect(themeService.getRealmThemeName).toHaveBeenCalledWith(mockRealm, 'login');
    });

    it('should resolve both template and layout', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      expect(templateService.resolve).toHaveBeenCalledTimes(2);
      expect(templateService.resolve).toHaveBeenCalledWith('authme', 'login', 'login');
      expect(templateService.resolve).toHaveBeenCalledWith('authme', 'login', 'layouts/main');
    });

    it('should include layout as relative path', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.layout).toMatch(/layouts[/\\]main\.hbs/);
    });

    it('should use data.realmName over realm.name when provided', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {
        realmName: 'custom-name',
        realmDisplayName: 'Custom Display',
      }, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmName).toBe('custom-name');
      expect(data.realmDisplayName).toBe('Custom Display');
    });

    it('should fall back to realm.name when data.realmName is not set', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmName).toBe('test-realm');
    });

    it('should fall back to realm.name when displayName is null', () => {
      const realmNoDisplay = { ...mockRealm, displayName: null };

      service.render(mockRes as any, realmNoDisplay, 'login', 'login', {}, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmDisplayName).toBe('test-realm');
    });

    it('should detect locale from request', () => {
      i18nService.detectLocale.mockReturnValue('fr');
      i18nService.isRtl.mockReturnValue(false);

      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      expect(i18nService.detectLocale).toHaveBeenCalledWith(mockReq);
      const [, data] = mockRes.render.mock.calls[0];
      expect(data.locale).toBe('fr');
      expect(data.dir).toBe('ltr');
    });

    it('should set dir="rtl" for Arabic locale', () => {
      i18nService.detectLocale.mockReturnValue('ar');
      i18nService.isRtl.mockReturnValue(true);

      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.locale).toBe('ar');
      expect(data.dir).toBe('rtl');
      expect(data.isRtl).toBe(true);
    });

    it('should include languageSwitcher array in template data', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      const [, data] = mockRes.render.mock.calls[0];
      expect(Array.isArray(data.languageSwitcher)).toBe(true);
      expect(data.languageSwitcher.length).toBeGreaterThan(0);
      const enEntry = data.languageSwitcher.find((l: any) => l.code === 'en');
      expect(enEntry).toBeDefined();
      expect(enEntry.active).toBe(true);
    });

    it('should pass messages with detected locale to messageService', () => {
      i18nService.detectLocale.mockReturnValue('de');

      service.render(mockRes as any, mockRealm, 'login', 'login', {}, mockReq as any);

      expect(messageService.getMessages).toHaveBeenCalledWith('authme', 'login', 'de');
    });

    it('should use realm.defaultLocale when no req is provided', () => {
      const realmWithLocale = { ...mockRealm, defaultLocale: 'es' };

      service.render(mockRes as any, realmWithLocale, 'login', 'login', {});

      expect(messageService.getMessages).toHaveBeenCalledWith('authme', 'login', 'es');
    });
  });
});
