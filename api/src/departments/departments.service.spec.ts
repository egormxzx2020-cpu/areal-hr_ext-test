import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PG_CONNECTION } from '../database/database.constants';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockClient: {
    query: jest.Mock;
    release: jest.Mock;
  };
  let mockPool: {
    query: jest.Mock;
    connect: jest.Mock;
  };
  let mockAuditService: {
    logChange: jest.Mock;
    calculateDiff: jest.Mock;
  };

  const sampleDepartment = {
    id: 'dept-1',
    organization_id: 'org-1',
    organization_name: 'ООО Ареал',
    parent_id: null,
    parent_name: null,
    name: 'Бухгалтерия',
    comment: 'Финансовый отдел',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
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

    mockAuditService = {
      logChange: jest.fn().mockResolvedValue(undefined),
      calculateDiff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен возвращать список отделов', async () => {
      const mockRows = [sampleDepartment];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.findAll();

      expect(result).toEqual(mockRows);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY (d.deleted_at IS NOT NULL)');
    });

    it('должен фильтровать по organization_id, если параметр передан', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] });

      const result = await service.findAll('org-1');

      expect(result).toEqual([sampleDepartment]);
      expect(mockPool.query.mock.calls[0][0]).toContain('AND d.organization_id = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['org-1']);
    });
  });

  describe('findOne', () => {
    it('должен возвращать отдел по ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] });

      const result = await service.findOne('dept-1');

      expect(result).toEqual(sampleDepartment);
      expect(mockPool.query.mock.calls[0][0]).toContain('WHERE d.id = $1 AND d.deleted_at IS NULL');
    });

    it('должен выбрасывать NotFoundException, если отдел не найден или удален', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('должен успешно создавать отдел и логировать создание в audit_logs', async () => {
      const createDto = {
        organization_id: 'org-1',
        parent_id: null,
        name: 'IT отдел',
        comment: 'Разработка ПО',
      };
      const createdRecord = { id: 'new-dept-id', ...createDto, deleted_at: null };

      // 1. Проверка существования организации
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'org-1' }] });
      // 2. INSERT INTO departments
      mockPool.query.mockResolvedValueOnce({ rows: [createdRecord] });

      mockAuditService.calculateDiff.mockReturnValueOnce({
        name: { old: null, new: 'IT отдел' },
      });

      const result = await service.create(createDto);

      expect(result).toEqual(createdRecord);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        entityType: 'Department',
        entityId: 'new-dept-id',
        changedFields: { name: { old: null, new: 'IT отдел' } },
      });
    });

    it('должен выбрасывать BadRequestException, если указанная организация не найдена', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.create({ organization_id: 'bad-org', name: 'Отдел' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен выбрасывать BadRequestException, если родительский отдел принадлежит другой организации', async () => {
      // 1. Организация найдена
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'org-1' }] });
      // 2. Родительский отдел найден, но organization_id = 'org-2'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'dept-parent', organization_id: 'org-2' }],
      });

      await expect(
        service.create({
          organization_id: 'org-1',
          parent_id: 'dept-parent',
          name: 'Подотдел',
        }),
      ).rejects.toThrow(
        new BadRequestException('Родительский отдел должен принадлежать той же организации'),
      );
    });
  });

  describe('update', () => {
    it('должен выбрасывать BadRequestException при попытке назначить родителем самого себя', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] }); // findOne

      await expect(
        service.update('dept-1', {
          organization_id: 'org-1',
          parent_id: 'dept-1',
          name: 'Отдел',
        }),
      ).rejects.toThrow(
        new BadRequestException('Отдел не может быть родительским сам для себя'),
      );
    });

    it('должен блокировать создание циклической зависимости (A -> B -> A) через CTE-поиск', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] }); // findOne
      // Проверка родительского отдела
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'dept-parent', organization_id: 'org-1' }],
      });
      // CTE-запрос возвращает строку (найден цикл)
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

      await expect(
        service.update('dept-1', {
          organization_id: 'org-1',
          parent_id: 'dept-parent',
          name: 'Отдел',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Циклическая зависимость: выбранный родительский отдел является потомком текущего отдела',
        ),
      );
    });

    it('должен успешно обновлять отдел и фиксировать дифференциал в audit_logs', async () => {
      const updatedRecord = { ...sampleDepartment, name: 'Главная Бухгалтерия' };

      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [updatedRecord] }); // UPDATE

      mockAuditService.calculateDiff.mockReturnValueOnce({
        name: { old: 'Бухгалтерия', new: 'Главная Бухгалтерия' },
      });

      const result = await service.update('dept-1', {
        organization_id: 'org-1',
        name: 'Главная Бухгалтерия',
      });

      expect(result).toEqual(updatedRecord);
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        entityType: 'Department',
        entityId: 'dept-1',
        changedFields: { name: { old: 'Бухгалтерия', new: 'Главная Бухгалтерия' } },
      });
    });
  });

  describe('remove', () => {
    it('должен выбрасывать ConflictException (409), если у отдела есть активные дочерние подразделения', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // childDepts (есть дети)
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove('dept-1')).rejects.toThrow(ConflictException);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('должен выполнять мягкое удаление в транзакции и логировать событие в audit_logs', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // childDepts (детей нет)
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'dept-1', deleted_at: new Date() }],
      }); // UPDATE
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const result = await service.remove('dept-1');

      expect(result).toEqual({ success: true, id: 'dept-1' });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Department',
          entityId: 'dept-1',
          client: mockClient,
        }),
      );
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});