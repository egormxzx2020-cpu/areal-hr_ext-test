import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PG_CONNECTION } from '../database/database.constants';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockClient: { query: jest.Mock; release: jest.Mock };
  let mockPool: { query: jest.Mock; connect: jest.Mock };
  let mockAuditService: { logChange: jest.Mock; calculateDiff: jest.Mock };

  const sampleDepartment = {
    id: '11111111-1111-4111-8111-111111111111',
    organization_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    organization_name: 'ООО Ареал',
    parent_id: null,
    parent_name: null,
    name: 'Отдел разработки',
    comment: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };

  beforeEach(async () => {
    mockClient = { query: jest.fn(), release: jest.fn() };
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
        { provide: PG_CONNECTION, useValue: mockPool },
        { provide: AuditService, useValue: mockAuditService },
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
        { id: 'dept-1', name: 'Отдел кадров', deleted_at: null },
        { id: 'dept-2', name: 'Архив', deleted_at: '2026-01-01' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.findAll();

      expect(result).toEqual(mockRows);
      expect(mockPool.query.mock.calls[0][0]).toContain(
        'ORDER BY (d.deleted_at IS NOT NULL)',
      );
    });

    it('должен фильтровать отделы по organization_id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const orgId = '11111111-1111-4111-8111-111111111111';

      await service.findAll(orgId);

      expect(mockPool.query.mock.calls[0][0]).toContain(
        'AND d.organization_id = $1',
      );
      expect(mockPool.query.mock.calls[0][1]).toEqual([orgId]);
    });
  });

  describe('findOne', () => {
    it('должен возвращать отдел по ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDepartment] });

      const result = await service.findOne(sampleDepartment.id);

      expect(result).toEqual(sampleDepartment);
      expect(mockPool.query.mock.calls[0][0]).toContain(
        'WHERE d.id = $1 AND d.deleted_at IS NULL',
      );
    });

    it('должен выбрасывать NotFoundException, если отдел не найден', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('должен выбрасывать BadRequestException, если организация не найдена', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.create({ organization_id: 'org-1', name: 'Отдел кадров' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (защита от циклов и валидация связей)', () => {
    const deptId = '11111111-1111-4111-8111-111111111111';
    const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('должен выбрасывать BadRequestException при попытке назначить родителем самого себя', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: deptId, organization_id: orgId }],
      }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] }); // orgRes

      await expect(
        service.update(deptId, {
          name: 'Отдел A',
          organization_id: orgId,
          parent_id: deptId,
        }),
      ).rejects.toThrow(
        new BadRequestException('Отдел не может быть родительским сам для себя'),
      );
    });

    it('должен блокировать создание циклической зависимости (A -> B -> A)', async () => {
      const parentId = '22222222-2222-4222-8222-222222222222';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: deptId, organization_id: orgId }],
      }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] }); // orgRes
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: parentId, organization_id: orgId }],
      }); // parentRes
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: parentId }],
      }); // cycleCheck

      await expect(
        service.update(deptId, {
          name: 'Отдел A',
          organization_id: orgId,
          parent_id: parentId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove (409 Conflict и транзакция)', () => {
    const deptId = 'dept-to-delete';

    it('должен выбрасывать ConflictException (409), если есть дочерние отделы', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // childDepts
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove(deptId)).rejects.toThrow(ConflictException);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('должен выбрасывать ConflictException (409), если отдел используется в кадровых приказах', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // childDepts
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // actionsUsage
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove(deptId)).rejects.toThrow(
        new ConflictException(
          'Невозможно удалить отдел, так как он используется в кадровых приказах',
        ),
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('должен выполнять мягкое удаление (UPDATE deleted_at) при отсутствии связей', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: deptId, deleted_at: null }],
      }); // findOne
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // childDepts
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // actionsUsage
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: deptId, deleted_at: '2026-05-01T10:00:00Z' }],
      }); // UPDATE
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const result = await service.remove(deptId);

      expect(result).toEqual({ success: true, id: deptId });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(1);
    });
  });
});