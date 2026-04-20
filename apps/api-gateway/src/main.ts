import 'reflect-metadata';
import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Gateway — Release Approval')
    .setDescription(
      [
        'Entrada HTTP única para el front. Agrupado por **microservicio de destino**.',
        '',
        '- **release-service** — login, CRUD de releases, reglas de aprobación (SQLite).',
        '- **integration-service** — cobertura desde GitHub (Octokit).',
        '',
        '`rules-service` y `notification-service` no se exponen por el gateway; el release-service los llama internamente.',
        '',
        'Usa **Authorize** con el JWT devuelto por `POST /api/auth/login` (excepto login).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag(
      'release-service',
      'Proxy → `release-service:3001` — auth, releases, reglas',
    )
    .addTag(
      'integration-service',
      'Proxy → `integration-service:3003` — cobertura CI / GitHub',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(3000);
}
bootstrap();
