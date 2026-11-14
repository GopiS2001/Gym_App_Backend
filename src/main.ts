import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') || 3000);
  const uploadDir = config.get<string>('UPLOAD_DIR') || 'uploads';

  // Exercise images, progress photos and other uploads. `index: false` keeps
  // a missing file a plain 404 instead of an attempted directory listing.
  app.useStaticAssets(join(process.cwd(), uploadDir), {
    prefix: `/${uploadDir}`,
    index: false,
    maxAge: '7d',
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  // The mobile client runs from an Expo dev server on an arbitrary LAN
  // origin, so the API accepts any origin; it is protected by JWT, not CORS.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Personal Gym & Fitness Tracker API')
    .setDescription(
      'Private REST API for the personal gym tracker. Every endpoint except ' +
        'login, setup and refresh requires a bearer access token.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Binding to 0.0.0.0 lets a phone on the same Wi-Fi reach the dev server.
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API ready on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs on http://localhost:${port}/api/docs`);
}

bootstrap();
