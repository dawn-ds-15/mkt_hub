import { NestFactory } from '@nestjs/core';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { fileStorage } from './common/storage/file-storage';
import { buildTrackerScriptSource } from './modules/profiles/utils/tracking.util';

// Global BigInt serialization handler for Express JSON responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpLogger = new Logger('HTTP');
  
  // Disable X-Powered-By header to prevent Express exposure
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Serve static files in uploads folder
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Clean Content-Type header for GET/DELETE requests to prevent body-parser from throwing 400 on empty bodies
  app.use((req: any, res: any, next: any) => {
    if (
      (req.method === 'GET' || req.method === 'DELETE') &&
      req.headers['content-type']
    ) {
      delete req.headers['content-type'];
    }
    next();
  });

  // Root health check endpoint & /t.js tracker script
  app.use((req: any, res: any, next: any) => {
    if (req.path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      return res.status(200).send('OK');
    }
    if (req.path === '/t.js' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send(buildTrackerScriptSource());
    }
    next();
  });

  // Log incoming HTTP requests and responses
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const logMessage = `${method} ${originalUrl} ${statusCode} +${duration}ms`;
      if (statusCode >= 500) {
        httpLogger.error(logMessage);
      } else if (statusCode >= 400) {
        httpLogger.warn(logMessage);
      } else {
        httpLogger.log(logMessage);
      }
    });
    next();
  });

  app.setGlobalPrefix('api');
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8080',
        'https://mkthub-pied.vercel.app',
        'https://smartlog-event.github.io',
      ];
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errors) => {
        const formatErrors = (errs: any[]): string[] => {
          const messages: string[] = [];
          for (const err of errs) {
            if (err.constraints) {
              messages.push(...(Object.values(err.constraints) as string[]));
            }
            if (err.children && err.children.length > 0) {
              messages.push(...formatErrors(err.children));
            }
          }
          return messages;
        };
        const messages = formatErrors(errors);
        httpLogger.warn(`[Validation Failed] ${JSON.stringify(messages)}`);
        return new BadRequestException(messages);
      },
    }),
  );

  // Configure Swagger Document
  const config = new DocumentBuilder()
    .setTitle('MKT Hub APIs')
    .setDescription(
      'Tài liệu hướng dẫn sử dụng và thử nghiệm APIs cho Marketing Operations Platform (MKT Hub)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  fileStorage.logMode();
}
bootstrap();
