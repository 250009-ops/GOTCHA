import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { ensureLanguageCatalog } from './common/language-catalog';
import {
  applySecurityHeaders,
  assertProductionAuthConfig,
  corsOriginsFromEnv,
  isProductionRuntime,
} from './common/runtime-security';
import { PrismaService } from './prisma/prisma.service';

function preloadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function bootstrap() {
  preloadEnvFile(join(process.cwd(), '.env'));
  preloadEnvFile(join(process.cwd(), '../../.env'));
  assertProductionAuthConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.set('trust proxy', 1);
  // Import paste / admin ingest can carry long novels; everything else stays small.
  app.use('/api/v1/imports', json({ limit: '24mb' }));
  app.use('/api/v1/admin/content', json({ limit: '24mb' }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  // W-23: large book payloads (GET /content/:id is 120-200 kB for 700-1,000-page books) reached
  // some browsers as "200, empty body" through nginx proxy buffering (spill to proxy_temp), so the
  // reader showed "Kontent topilmadi". We cannot change VPS2 nginx, so: gzip JSON in the app
  // (~5x smaller) and tell nginx not to buffer these responses (X-Accel-Buffering is honoured
  // per response and needs no nginx change). Audio (audio/*) is left uncompressed.
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => !/^audio\//.test(String(res.getHeader('Content-Type') ?? '')) && compression.filter(req, res),
    }),
  );
  app.use('/api/v1/content', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') res.setHeader('X-Accel-Buffering', 'no');
    next();
  });
  app.use((_req: Request, res: Response, next: NextFunction) => {
    applySecurityHeaders(res);
    next();
  });

  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; sandbox");
    },
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = corsOriginsFromEnv();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const swaggerEnabled = process.env.ENABLE_SWAGGER === 'true' || !isProductionRuntime();
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Gotcha API')
      .setDescription('Language learning through reading — production API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 3000);
  const prisma = app.get(PrismaService);
  if (prisma.dbAvailable) {
    try {
      await ensureLanguageCatalog(prisma);
    } catch (err) {
      console.error('Language catalog warmup failed', err);
    }
  }
  await app.listen(port);
  console.log(`Gotcha API running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
