import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { registerHandlebarsHelpers } from './theme/handlebars-helpers.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          formAction: null,
          upgradeInsecureRequests: null,
        },
      },
      hsts: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  // Dynamic CORS: validate Origin against client webOrigins stored in the database.
  // This replaces the previous `app.enableCors()` which allowed all origins (*).
  const prisma = app.get(PrismaService);
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
        // Check if any enabled client has '*' (allow all) or the specific origin in webOrigins
        const matchingClient = await prisma.client.findFirst({
          where: {
            enabled: true,
            OR: [
              { webOrigins: { has: origin } },
              { webOrigins: { has: '*' } },
            ],
          },
          select: { id: true },
        });

        callback(null, !!matchingClient);
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
