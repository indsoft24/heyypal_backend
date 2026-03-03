import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { AppModule } from './app.module';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');

  const uploadDir =
    process.env.UPLOAD_DIR ||
    process.env.FILE_STORAGE_PATH ||
    join(process.cwd(), 'uploads');
  await mkdir(join(uploadDir, 'expert-photos'), { recursive: true });
  await mkdir(join(uploadDir, 'expert-videos'), { recursive: true });
  await mkdir(join(uploadDir, 'expert-documents'), { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Authorization,Content-Type',
  });

  const config = new DocumentBuilder()
    .setTitle('HeyyPal API')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 5001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`HeyyPal API running on ${host}:${port}`);
}
bootstrap();
