import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Disable default body parser so we can raise the JSON limit for long paste imports (~5M chars).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = (
    process.env.API_CORS_ORIGINS ??
    'http://localhost:5173,http://localhost:5174,http://localhost:5175'
  )
    .split(',')
    .map((o) => o.trim());

  app.enableCors({ origin: corsOrigins, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('Gotcha API')
    .setDescription('Language learning through reading — production API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`Gotcha API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
