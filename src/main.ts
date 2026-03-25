import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { registerHandlebarsHelpers } from './theme/handlebars-helpers.js';
import { CorsOriginService } from './cors/cors-origin.service.js';

/** Known-insecure / placeholder values that must never reach production. */
const INSECURE_ADMIN_API_KEY_VALUES = new Set([
  'REPLACE_ME_WITH_A_STRONG_RANDOM_SECRET',
  'dev-admin-key-change-in-production',
  'changeme',
  'secret',
  'admin',
  'password',
]);

const MIN_ADMIN_API_KEY_LENGTH = 32;

function validateAdminApiKey(): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const key = process.env['ADMIN_API_KEY'];

  // Absent key — guard falls back to JWT-only mode; warn in production.
  if (!key) {
    if (isProduction) {
      console.warn(
        '[SECURITY] ADMIN_API_KEY is not set. ' +
          'The static API-key authentication path is disabled. ' +
          'Ensure admin JWT authentication is properly configured.',
      );
    }
    return;
  }

  const isInsecureValue = INSECURE_ADMIN_API_KEY_VALUES.has(key);
  const isTooShort = key.length < MIN_ADMIN_API_KEY_LENGTH;

  if (isProduction) {
    if (isInsecureValue) {
      console.error(
        '[SECURITY] FATAL: ADMIN_API_KEY is set to a known placeholder or insecure value. ' +
          'Set a strong, randomly generated secret (e.g. `openssl rand -hex 32`) ' +
          'before running in production.',
      );
      process.exit(1);
    }

    if (isTooShort) {
      console.error(
        `[SECURITY] FATAL: ADMIN_API_KEY must be at least ${MIN_ADMIN_API_KEY_LENGTH} characters long in production. ` +
          'Generate one with: openssl rand -hex 32',
      );
      process.exit(1);
    }
  } else {
    // Development / test: warn but do not block startup.
    if (isInsecureValue || isTooShort) {
      console.warn(
        '[SECURITY] WARNING: ADMIN_API_KEY is weak or a placeholder. ' +
          'This is acceptable in development but MUST be replaced before deploying to production.',
      );
    }
  }
}

async function bootstrap() {
  validateAdminApiKey();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  // ── Reverse-proxy trust configuration ──────────────────────────────────────
  // Configure Express's built-in "trust proxy" setting to match the
  // TRUSTED_PROXIES environment variable.  Express uses this to populate
  // req.ip / req.ips from X-Forwarded-For, but our own resolveClientIp()
  // utility performs the same check independently and is the authoritative
  // source for all rate-limiting decisions.
  //
  // Setting trust proxy here ensures that other Express-level code (e.g.
  // session middleware) that reads req.ip also behaves correctly.
  const trustedProxiesEnv = process.env['TRUSTED_PROXIES'];
  if (trustedProxiesEnv && trustedProxiesEnv.trim() !== '') {
    if (trustedProxiesEnv.trim() === '*') {
      app.set('trust proxy', true);
    } else {
      // Provide the list directly; Express accepts a comma-separated string.
      app.set('trust proxy', trustedProxiesEnv);
    }
  }
  // When TRUSTED_PROXIES is not set we leave "trust proxy" at its default
  // (false), so Express never touches X-Forwarded-For.

  // Enable URI-based versioning: versioned routes are accessible at /api/v{N}/...
  // Unversioned routes continue to work (backward-compatible) but carry
  // Deprecation + Sunset headers injected by DeprecationInterceptor.
  app.enableVersioning({ type: VersioningType.URI, prefix: 'api/v' });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: false,
    }),
  );
  // Dynamic CORS: validate Origin against the cached set of client webOrigins.
  // Origins are loaded from the database once and cached in Redis (TTL 300 s) plus
  // an in-process Set.  This avoids a DB round-trip on every cross-origin request.
  // The cache is invalidated automatically whenever a client is created, updated,
  // or deleted (see ClientsService).
  const corsOriginService = app.get(CorsOriginService);
  app.enableCors({
    origin: async (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no Origin header (server-to-server, curl, same-origin)
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const allowed = await corsOriginService.isOriginAllowed(origin);
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
  });
  app.use(cookieParser());

  // Handlebars template engine — templates live in themes/ and are resolved by ThemeRenderService
  app.setBaseViewsDir(join(__dirname, '..', 'themes'));
  app.setViewEngine('hbs');

  // Block access to template sources, config files, and message bundles
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use('/themes', (req: { path: string }, res: { status: (code: number) => { json: (body: object) => void } }, next: () => void) => {
    if (/\.(hbs|properties)$/.test(req.path) || req.path.includes('theme.json')) {
      res.status(403).json({ statusCode: 403, message: 'Forbidden' });
      return;
    }
    next();
  });

  app.useStaticAssets(join(__dirname, '..', 'themes'), { prefix: '/themes' });

  // Register theme engine Handlebars helpers ({{msg}}, {{msgArgs}})
  registerHandlebarsHelpers();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('AuthMe')
    .setDescription('Open-source Identity and Access Management Server')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-admin-api-key', in: 'header' }, 'admin-api-key')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Redirect /console → /console/ to match Vite's base URL
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/console', (_req: unknown, res: { redirect: (url: string) => void }) => {
    res.redirect('/console/');
  });

  // SPA fallback: serve index.html for /console/* navigation routes (skip static files)
  const adminUiIndex = join(__dirname, 'admin-ui', 'index.html');
  expressApp.get(
    '/console/{*path}',
    (req: { path: string }, res: { sendFile: (path: string) => void }, next: () => void) => {
      if (/\.\w+$/.test(req.path)) {
        next();
        return;
      }
      res.sendFile(adminUiIndex);
    },
  );

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  console.log(`AuthMe is running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}
bootstrap();
