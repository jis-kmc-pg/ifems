import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ 한글 인코딩 수정 (UTF-8)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // CORS 설정 (개발 환경에서는 모든 origin 허용)
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'])
      : true, // 개발 환경: 모든 origin 허용
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Prefix
  app.setGlobalPrefix('api');

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('i-FEMS API')
    .setDescription('Intelligence Facility & Energy Management System API')
    .setVersion('1.0')
    .addTag('monitoring', '모니터링 API')
    .addTag('dashboard', '대시보드 API')
    .addTag('alerts', '알림 API')
    .addTag('analysis', '분석 API')
    .addTag('settings', '설정 API')
    .addTag('tags', '태그 관리 API')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4500;
  await app.listen(port);
  console.log(`🚀 i-FEMS API Server running on http://localhost:${port}/api`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
