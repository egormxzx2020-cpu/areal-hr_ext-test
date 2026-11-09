import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PgExceptionFilter } from './common/filters/pg-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Ограничиваем CORS конкретными источниками из конфигурации
  const allowedOrigins = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:9000,http://localhost:8080',
  );

  app.enableCors({
    origin: allowedOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // Глобальный перехват ошибок СУБД (23505 -> 409 Conflict, 23503 -> 400 Bad Request)
  app.useGlobalFilters(new PgExceptionFilter());

  // Поддержка переменных PORT и API_PORT из .env
  const port =
    configService.get<number>('PORT') ||
    configService.get<number>('API_PORT') ||
    3000;

  await app.listen(port);
}

// void предотвращает ошибку линтера @typescript-eslint/no-floating-promises
void bootstrap();