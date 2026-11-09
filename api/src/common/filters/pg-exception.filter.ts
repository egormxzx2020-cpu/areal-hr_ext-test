import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class PgExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PgExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Стандартные исключения NestJS (HttpException: NotFound, BadRequest и т.д.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(
        typeof res === 'string' ? { statusCode: status, message: res } : res,
      );
    }

    // 2. Ошибка нарушения уникальности PostgreSQL (unique_violation: 23505)
    if (exception?.code === '23505') {
      const constraint = exception?.constraint;
      let message = 'Запись с такими уникальными данными уже существует';

      if (constraint === 'idx_organizations_name_unique') {
        message = 'Организация с таким наименованием уже существует';
      } else if (constraint === 'idx_positions_name_unique') {
        message = 'Должность с таким наименованием уже существует';
      } else if (constraint === 'idx_departments_org_parent_name_unique') {
        message = 'Отдел с таким наименованием уже существует в выбранном подразделении/организации';
      } else if (constraint === 'idx_users_login_unique') {
        message = 'Пользователь с таким логином уже существует';
      }

      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message,
        error: 'Conflict',
      });
    }

    // 3. Ошибка нарушения внешнего ключа PostgreSQL (foreign_key_violation: 23503)
    if (exception?.code === '23503') {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Связанная запись не найдена или на неё ссылаются другие данные',
        error: 'Bad Request',
      });
    }

    // 4. Прочие непредвиденные ошибки
    this.logger.error('Необработанная ошибка сервера:', exception?.stack || exception);

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Внутренняя ошибка сервера',
    });
  }
}