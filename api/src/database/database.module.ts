import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
  provide: PG_CONNECTION,
  useFactory: (configService: ConfigService) => {
    return new Pool({
      host: configService.get<string>('POSTGRES_HOST', 'localhost'),
      port: configService.get<number>('POSTGRES_PORT', 5432),
      user: configService.get<string>('POSTGRES_USER', 'postgres'),
      password: configService.get<string>('POSTGRES_PASSWORD', 'postgres_password'),
      database: configService.get<string>('POSTGRES_DB', 'areal_hr_db'),
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [dbProvider],
  exports: [PG_CONNECTION],
})
export class DatabaseModule {}