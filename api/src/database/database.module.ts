import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
  provide: PG_CONNECTION,
  useFactory: (configService: ConfigService) => {
    return new Pool({
      host: configService.getOrThrow<string>('POSTGRES_HOST'),
      port: configService.get<number>('POSTGRES_PORT', 5432),
      user: configService.getOrThrow<string>('POSTGRES_USER'),
      password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
      database: configService.getOrThrow<string>('POSTGRES_DB'),
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().default(5432),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        PORT: Joi.number().default(3000),
        CORS_ORIGIN: Joi.string().default('http://localhost:9000'),
      }),
    }),
  ],
  providers: [dbProvider],
  exports: [PG_CONNECTION],
})
export class DatabaseModule {}