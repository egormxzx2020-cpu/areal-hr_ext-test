import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PG_CONNECTION } from '../database/database.constants';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let mockClient: {
    query: jest.Mock;
    release: jest.Mock;
  };
  let mockPool: {
    query: jest.Mock;
    connect: jest.Mock;
  };

  const sampleEmployeeDto = {
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
    birth_date: '1990-05-15',
    passport_series: '1234',
    passport_number: '567890',
    passport_issue_date: '2010-06-20',
    passport_department_code: '770-001',
    passport_issued_by: 'ОВД Тверского района г. Москвы',
    reg_region: 'г. Москва',
    reg_city: 'Москва',
    reg_street: 'Тверская',
    reg_house: '12',
    reg_building: null,
    reg_apartment: '5',
    file_ids: ['11111111-1111-4111-8111-111111111111'],
  };

  beforeEach(async () => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен возвращать список сотрудников с сортировкой по удалению', async () => {
      const mockRows = [{ id: 'emp-1', last_name: 'Иванов', files_count: 2 }];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.findAll();

      expect(result).toEqual(mockRows);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY (e.deleted_at IS NOT NULL)');
    });

    it('должен применять фильтр ILIKE при передаче search', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.findAll('Иван');

      expect(mockPool.query.mock.calls[0][0]).toContain('e.last_name ILIKE $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['%Иван%']);
    });
  });

  describe('findOne', () => {
    it('должен возвращать сотрудника по id', async () => {
      const mockEmp = { id: 'emp-1', last_name: 'Иванов', passport_files: [] };
      mockPool.query.mockResolvedValueOnce({ rows: [mockEmp] });

      const result = await service.findOne('emp-1');

      expect(result).toEqual(mockEmp);
    });

    it('должен выбрасывать NotFoundException, если сотрудник не найден', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('должен создавать сотрудника и привязывать сканы в транзакции', async () => {
      const createdId = 'new-emp-id';
      const createdRecord = { id: createdId, ...sampleEmployeeDto, passport_files: [] };

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. INSERT INTO employees
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: createdId }] });
      // 3. INSERT INTO employee_passport_files
      mockClient.query.mockResolvedValueOnce({});
      // 4. COMMIT
      mockClient.query.mockResolvedValueOnce({});
      // 5. findOne (вызов через pool.query)
      mockPool.query.mockResolvedValueOnce({ rows: [createdRecord] });

      const result = await service.create(sampleEmployeeDto);

      expect(result).toEqual(createdRecord);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('должен блокировать редактирование удаленного сотрудника', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', deleted_at: '2026-01-01' }],
      });

      await expect(service.update('emp-1', sampleEmployeeDto)).rejects.toThrow(
        new BadRequestException('Нельзя редактировать удаленного сотрудника'),
      );
    });
  });

  describe('remove', () => {
    it('должен ставить deleted_at сотруднику (soft delete)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }] }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }] }); // update

      const result = await service.remove('emp-1');

      expect(result).toEqual({ success: true, id: 'emp-1' });
      expect(mockPool.query.mock.calls[1][0]).toContain('SET deleted_at = CURRENT_TIMESTAMP');
    });
  });
});