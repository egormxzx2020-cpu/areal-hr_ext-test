import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PG_CONNECTION } from '../database/database.constants';

describe('AuditService', () => {
  let service: AuditService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDiff', () => {
    it('должен формировать diff для новой сущности (old: null)', () => {
      const result = service.calculateDiff(null, { name: 'IT отдел', code: 101 });
      expect(result).toEqual({
        name: { old: null, new: 'IT отдел' },
        code: { old: null, new: 101 },
      });
    });

    it('должен находить только изменившиеся поля', () => {
      const oldObj = { name: 'Старое имя', comment: 'Без изменений' };
      const newObj = { name: 'Новое имя', comment: 'Без изменений' };

      const result = service.calculateDiff(oldObj, newObj);
      expect(result).toEqual({
        name: { old: 'Старое имя', new: 'Новое имя' },
      });
    });

    it('должен игнорировать системные поля (created_at, updated_at)', () => {
      const oldObj = { name: 'A', updated_at: '2026-01-01' };
      const newObj = { name: 'A', updated_at: '2026-02-01' };

      const result = service.calculateDiff(oldObj, newObj);
      expect(result).toEqual({});
    });
  });

  describe('logChange', () => {
    it('должен вставлять запись в audit_logs при наличии изменений', async () => {
      mockPool.query.mockResolvedValueOnce({});

      await service.logChange({
        entityType: 'Organization',
        entityId: '00000000-0000-0000-0000-000000000001',
        changedFields: { name: { old: 'ООО А', new: 'ООО Б' } },
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('INSERT INTO audit_logs');
    });

    it('не должен вызывать query, если changedFields пуст', async () => {
      await service.logChange({
        entityType: 'Organization',
        entityId: '00000000-0000-0000-0000-000000000001',
        changedFields: {},
      });

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});