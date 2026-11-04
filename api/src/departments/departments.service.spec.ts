import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PG_CONNECTION } from '../database/database.constants';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

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
        DepartmentsService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен возвращать список отделов с сортировкой по признаку удаления', async () => {
      const mockRows = [
        { id: 'dept-1', name: 'Отдел кадров', organization_name: 'ООО Ареал', deleted_at: null },
        { id: 'dept-2', name: 'Бухгалтерия', organization_name: 'ООО Ареал', deleted_at: '2026-01-01' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.findAll();

      expect(result).toEqual(mockRows);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY (d.deleted_at IS NOT NULL)');
    });

    it('должен фильтровать отделы по organization_id, если параметр передан', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const orgId = '11111111-1111-4111-8111-111111111111';

      await service.findAll(orgId);

      expect(mockPool.query.mock.calls[0][0]).toContain('AND d.organization_id = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual([orgId]);
    });
  });

  describe('findOne', () => {
    it('должен возвращать отдел по корректному id', async () => {
      const mockDept = { id: 'dept-1', name: 'Дирекция' };
      mockPool.query.mockResolvedValueOnce({ rows: [mockDept] });

      const result = await service.findOne('dept-1');

      expect(result).toEqual(mockDept);
    });

    it('должен выбрасывать NotFoundException, если отдел не найден', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'IT-Отдел',
      organization_id: '11111111-1111-4111-8111-111111111111',
      parent_id: null,
    };

    it('должен выбрасывать BadRequestException, если организация не найдена или удалена', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException('Указанная организация не найдена или удалена'),
      );
    });

    it('должен выбрасывать BadRequestException, если родительский отдел принадлежит другой организации', async () => {
      const dtoWithParent = {
        ...dto,
        parent_id: '22222222-2222-4222-8222-222222222222',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [{ id: dto.organization_id }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: dtoWithParent.parent_id, organization_id: 'other-org-id' }],
      });

      await expect(service.create(dtoWithParent)).rejects.toThrow(
        new BadRequestException('Родительский отдел обязан принадлежать той же организации'),
      );
    });

    it('должен успешно создавать отдел при корректных связях', async () => {
      const createdDept = { id: 'new-id', ...dto };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: dto.organization_id }] });
      mockPool.query.mockResolvedValueOnce({ rows: [createdDept] });

      const result = await service.create(dto);

      expect(result).toEqual(createdDept);
    });
  });

  describe('update (защита от циклов)', () => {
    const deptId = '11111111-1111-4111-8111-111111111111';
    const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('должен выбрасывать BadRequestException при попытке назначить родителем самого себя', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId, organization_id: orgId }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] });

      const dto = {
        name: 'Отдел',
        organization_id: orgId,
        parent_id: deptId,
      };

      await expect(service.update(deptId, dto)).rejects.toThrow(
        new BadRequestException('Отдел не может быть родительским сам для себя'),
      );
    });

    it('должен блокировать создание циклической зависимости (A -> B -> A) через CTE-поиск', async () => {
      const parentId = '22222222-2222-4222-8222-222222222222';
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId, organization_id: orgId }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: parentId, organization_id: orgId }] });
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: parentId }] });

      const dto = {
        name: 'Отдел A',
        organization_id: orgId,
        parent_id: parentId,
      };

      await expect(service.update(deptId, dto)).rejects.toThrow(
        new BadRequestException(
          'Нельзя назначить родительским подразделение, которое уже является дочерним для данного отдела (обнаружено циклическое замыкание)',
        ),
      );
    });
  });

  describe('remove (409 Conflict и Soft Delete в транзакции)', () => {
    const deptId = 'dept-to-delete';

    it('должен выбрасывать ConflictException (409) и делать ROLLBACK, если есть неудаленные потомки', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ 1: 1 }] }); // SELECT childDepts
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove(deptId)).rejects.toThrow(ConflictException);
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('должен выполнять мягкое удаление (UPDATE deleted_at) и COMMIT, если дочерних отделов нет', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // SELECT childDepts
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: deptId }] }); // UPDATE departments
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const result = await service.remove(deptId);

      expect(result).toEqual({ success: true, id: deptId });
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});