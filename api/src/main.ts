import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Поддержка и PORT, и API_PORT из .env
  const port =
    configService.get<number>('PORT') ||
    configService.get<number>('API_PORT') ||
    3000;

  // Ограничиваем CORS конкретными источниками из конфигурации
  const allowedOrigins = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:9000,http://localhost:8080',
  );

  app.enableCors({
    origin: allowedOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();