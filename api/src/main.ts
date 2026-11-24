import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import session = require('express-session');
import connectPgSimple = require('connect-pg-simple');
import * as passportModule from 'passport';
import { AppModule } from './app.module';
import { PgExceptionFilter } from './common/filters/pg-exception.filter';
import { PG_CONNECTION } from './database/database.constants';

const passport =
  (passportModule as { default?: typeof passportModule }).default ?? passportModule;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const pgPool = app.get<Pool>(PG_CONNECTION);
  const PgSessionStore = connectPgSimple(session);

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:9000,http://localhost:8080',
  );
  const sessionSecret = configService.get<string>(
    'SESSION_SECRET',
    'areal-hr-dev-session-secret-change-me',
  );
  const port =
    configService.get<number>('PORT') ||
    configService.get<number>('API_PORT') ||
    3000;

  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.use(
    session({
      store: new PgSessionStore({
        pool: pgPool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      name: 'areal_hr.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 12,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.useGlobalFilters(new PgExceptionFilter());

  await app.listen(port);
}

void bootstrap();