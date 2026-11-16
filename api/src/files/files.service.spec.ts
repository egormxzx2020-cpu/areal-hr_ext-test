import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PG_CONNECTION } from '../database/database.constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('FilesService & FilesController', () => {
  let service: FilesService;
  let controller: FilesController;
  let mockPool: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        FilesService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    controller = module.get<FilesController>(FilesController);
  });

  afterEach(() => {
    if (service) {
      service.onModuleDestroy();
    }
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('должен возвращать метаданные активного файла', async () => {
      const mockRecord = { id: 'file-1', name: 'passport.pdf', deleted_at: null };
      mockPool.query.mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await service.findById('file-1');

      expect(result).toEqual(mockRecord);
      expect(mockPool.query.mock.calls[0][0]).toContain('AND deleted_at IS NULL');
    });

    it('должен выбрасывать NotFoundException, если файл не найден или удален', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('должен выполнять мягкое удаление файла по ID', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'file-1', name: 'passport.pdf', deleted_at: null }],
      });
      mockPool.query.mockResolvedValueOnce({});

      const result = await service.softDelete('file-1');

      expect(result).toEqual({ success: true, id: 'file-1' });
      expect(mockPool.query.mock.calls[1][0]).toContain(
        'SET deleted_at = CURRENT_TIMESTAMP',
      );
    });
  });

  describe('cleanupOrphanFiles', () => {
    it('должен выполнять мягкое удаление (UPDATE deleted_at) непривязанных файлов', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'file-1' }, { id: 'file-2' }],
      });

      const result = await service.cleanupOrphanFiles(2);

      expect(result).toEqual({
        deletedCount: 2,
        deletedIds: ['file-1', 'file-2'],
      });
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('UPDATE files f');
      expect(sql).toContain('SET deleted_at = CURRENT_TIMESTAMP');
      expect(sql).not.toContain('DELETE FROM files');
      expect(mockPool.query.mock.calls[0][1]).toEqual([2]);
    });

    it('должен выбрасывать BadRequestException при передаче NaN или отрицательного числа', async () => {
      await expect(service.cleanupOrphanFiles(Number.NaN)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cleanupOrphanFiles(-5)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('контроллер должен отклонять некорректный параметр ?hours=abc со статусом 400', async () => {
      await expect(controller.cleanupOrphans('abc')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});