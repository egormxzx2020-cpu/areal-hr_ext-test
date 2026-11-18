import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface PgDatabaseError {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  idx_organizations_name_unique: 'Организация с таким наименованием уже существует',
  idx_positions_name_unique: 'Должность с таким наименованием уже существует',
  idx_departments_org_parent_name_unique:
    'В выбранном подразделении организации уже существует отдел с таким наименованием',
  idx_users_login_active: 'Пользователь с таким логином уже существует',
};

@Catch()
export class PgExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const pgError = exception as PgDatabaseError;

    // 23505 — unique_violation
    if (pgError && pgError.code === '23505') {
      const constraintName = pgError.constraint || '';
      const message =
        UNIQUE_CONSTRAINT_MESSAGES[constraintName] ||
        'Запись с такими уникальными данными уже существует';

      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message,
      });
      return;
    }

    // 23503 — foreign_key_violation
    if (pgError && pgError.code === '23503') {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Указана ссылка на несуществующую связанную запись',
      });
      return;
    }

    // Пробрасываем стандартные HTTP-исключения NestJS без искажения
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'getStatus' in exception &&
      typeof (exception as { getStatus: unknown }).getStatus === 'function'
    ) {
      const httpException = exception as {
        getStatus: () => number;
        getResponse: () => string | Record<string, unknown>;
      };
      const status = httpException.getStatus();
      const body = httpException.getResponse();

      if (typeof body === 'string') {
        response.status(status).json({ statusCode: status, message: body });
      } else {
        response.status(status).json(body);
      }
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}