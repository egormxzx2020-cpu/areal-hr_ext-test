import { Test, TestingModule } from '@nestjs/testing';
import { PositionsService } from './positions.service';
import { PG_CONNECTION } from '../database/database.constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('PositionsService', () => {
  let service: PositionsService;
  let mockPool: { query: jest.Mock };
  let mockAuditService: { logChange: jest.Mock; calculateDiff: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockAuditService = {
      logChange: jest.fn().mockResolvedValue(undefined),
      calculateDiff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionsService,
        { provide: PG_CONNECTION, useValue: mockPool },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PositionsService>(PositionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('remove', () => {
    it('должен выбрасывать NotFoundException, если должность не найдена', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await expect(service.remove('pos-1')).rejects.toThrow(NotFoundException);
    });

    it('должен выбрасывать ConflictException (409), если должность используется в кадровых приказах', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'pos-1', name: 'Инженер', deleted_at: null }],
      }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // usageCheck

      await expect(service.remove('pos-1')).rejects.toThrow(
        new ConflictException(
          'Невозможно удалить должность, так как она используется в кадровых приказах',
        ),
      );
      expect(mockAuditService.logChange).not.toHaveBeenCalled();
    });

    it('должен выполнять мягкое удаление, если должность не используется в приказах', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'pos-1', name: 'Инженер', deleted_at: null }],
      }); // findOne
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // usageCheck
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'pos-1', deleted_at: '2026-05-01T10:00:00Z' }],
      }); // UPDATE

      const result = await service.remove('pos-1');

      expect(result).toEqual({ success: true, id: 'pos-1' });
      expect(mockPool.query.mock.calls[2][0]).toContain(
        'SET deleted_at = CURRENT_TIMESTAMP',
      );
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(1);
    });
  });
});