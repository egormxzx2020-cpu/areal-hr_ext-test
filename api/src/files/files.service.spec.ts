import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { PG_CONNECTION } from '../database/database.constants';
import { NotFoundException } from '@nestjs/common';

describe('FilesService', () => {
  let service: FilesService;
  let mockPool: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
    jest.restoreAllMocks();
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

  describe('cleanupOrphanFiles', () => {
    it('должен возвращать 0 удаленных файлов, если непривязанных файлов нет', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.cleanupOrphanFiles(2);

      expect(result).toEqual({ deletedCount: 0, deletedIds: [] });
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('должен удалять физические файлы с диска и строки из БД для найденных сирот', async () => {
      const mockOrphans = [
        { id: 'file-1', file_path: 'uploads/passports/orphan1.pdf' },
        { id: 'file-2', file_path: 'uploads/passports/orphan2.png' },
      ];

      // 1. Поиск непривязанных файлов
      mockPool.query.mockResolvedValueOnce({ rows: mockOrphans });
      // 2. DELETE из таблицы files
      mockPool.query.mockResolvedValueOnce({});

      // Мокаем метод сервиса вместо системного модуля fs платформы Node.js
      const deleteSpy = jest
        .spyOn(service, 'deletePhysicalFile')
        .mockResolvedValue(undefined);

      const result = await service.cleanupOrphanFiles(2);

      expect(result.deletedCount).toBe(2);
      expect(result.deletedIds).toEqual(['file-1', 'file-2']);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledWith('uploads/passports/orphan1.pdf');
      expect(deleteSpy).toHaveBeenCalledWith('uploads/passports/orphan2.png');
      expect(mockPool.query.mock.calls[1][0]).toContain('DELETE FROM files WHERE id = ANY');
    });
  });
});