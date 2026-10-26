import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // <--- Разрешает фронтенду с порта 9000 слать запросы на 3000
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();