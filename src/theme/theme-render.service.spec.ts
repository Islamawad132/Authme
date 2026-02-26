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

  const mockRealm = {
    name: 'test-realm',
    displayName: 'Test Realm',
    theme: {},
  } as any;

  let mockRes: { render: jest.Mock };

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

    service = new ThemeRenderService(
      themeService as any,
      templateService as any,
      messageService as any,
    );

    mockRes = { render: jest.fn() };
  });

  describe('render', () => {
    it('should call res.render with correct template and data', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {
        formAction: '/login',
      });

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
      service.render(mockRes as any, mockRealm, 'login', 'login', {});

      expect(themeService.getRealmThemeName).toHaveBeenCalledWith(mockRealm, 'login');
    });

    it('should resolve both template and layout', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {});

      expect(templateService.resolve).toHaveBeenCalledTimes(2);
      expect(templateService.resolve).toHaveBeenCalledWith('authme', 'login', 'login');
      expect(templateService.resolve).toHaveBeenCalledWith('authme', 'login', 'layouts/main');
    });

    it('should include layout as relative path', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {});

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.layout).toMatch(/layouts[/\\]main\.hbs/);
    });

    it('should use data.realmName over realm.name when provided', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {
        realmName: 'custom-name',
        realmDisplayName: 'Custom Display',
      });

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmName).toBe('custom-name');
      expect(data.realmDisplayName).toBe('Custom Display');
    });

    it('should fall back to realm.name when data.realmName is not set', () => {
      service.render(mockRes as any, mockRealm, 'login', 'login', {});

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmName).toBe('test-realm');
    });

    it('should fall back to realm.name when displayName is null', () => {
      const realmNoDisplay = { ...mockRealm, displayName: null };

      service.render(mockRes as any, realmNoDisplay, 'login', 'login', {});

      const [, data] = mockRes.render.mock.calls[0];
      expect(data.realmDisplayName).toBe('test-realm');
    });
  });
});
