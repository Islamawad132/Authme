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
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      hsts: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.enableCors();
  app.use(cookieParser());

  // Handlebars template engine — templates live in themes/ and are resolved by ThemeRenderService
  app.setViewEngine('hbs');
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

  // SPA fallback: serve index.html for /console/* navigation routes (skip static files)
  const expressApp = app.getHttpAdapter().getInstance();
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
