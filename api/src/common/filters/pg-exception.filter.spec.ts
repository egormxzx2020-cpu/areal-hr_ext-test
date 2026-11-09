import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { PgExceptionFilter } from './pg-exception.filter';

describe('PgExceptionFilter', () => {
  let filter: PgExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PgExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    const mockResponse = {
      status: mockStatus,
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('должен транслировать ошибку 23505 организации в статус 409 Conflict с русским сообщением', () => {
    const pgError = {
      code: '23505',
      constraint: 'idx_organizations_name_unique',
    };

    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Организация с таким наименованием уже существует',
      error: 'Conflict',
    });
  });

  it('должен транслировать ошибку 23505 должности в статус 409 Conflict', () => {
    const pgError = {
      code: '23505',
      constraint: 'idx_positions_name_unique',
    };

    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Должность с таким наименованием уже существует',
      error: 'Conflict',
    });
  });

  it('должен пропускать стандартные HttpException без искажения', () => {
    const httpException = new NotFoundException('Ресурс не найден');

    filter.catch(httpException, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(httpException.getResponse());
  });
});