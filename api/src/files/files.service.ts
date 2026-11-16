import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';

export interface FileRecord {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  size: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

@Injectable()
export class FilesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FilesService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  onModuleInit() {
    // Фоновая мягкая очистка осиротевших файлов каждый час (файлы старше 2 часов)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanFiles(2).catch((err) => {
        this.logger.error(
          'Ошибка автоматической фоновой очистки файлов:',
          err?.stack || err,
        );
      });
    }, 60 * 60 * 1000);

    // unref() предотвращает блокировку завершения процесса Node.js в тестах
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Сохранение метаданных загруженного файла в таблицу files
   */
  async saveFile(
    file: Express.Multer.File,
  ): Promise<Omit<FileRecord, 'file_path' | 'deleted_at'>> {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const res = await this.pool.query(
      `INSERT INTO files (name, file_path, mime_type, size)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, mime_type, size, created_at, updated_at`,
      [originalName, file.path, file.mimetype, file.size],
    );

    return res.rows[0];
  }

  /**
   * Получение метаданных активного файла по ID
   */
  async findById(id: string): Promise<FileRecord> {
    const res = await this.pool.query(
      `SELECT id, name, file_path, mime_type, size, created_at, updated_at, deleted_at
       FROM files
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );

    if (!res.rows[0]) {
      throw new NotFoundException(`Файл с идентификатором ${id} не найден`);
    }

    return res.rows[0];
  }

  /**
   * Мягкое удаление файла (Soft Delete)
   */
  async softDelete(id: string): Promise<{ success: boolean; id: string }> {
    const current = await this.findById(id);

    await this.pool.query(
      `UPDATE files
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [current.id],
    );

    return { success: true, id: current.id };
  }

  /**
   * Мягкая очистка непривязанных (осиротевших) файлов.
   * Помечает deleted_at = CURRENT_TIMESTAMP для файлов без связей в employee_passport_files,
   * созданных ранее olderThanHours часов назад.
   */
  async cleanupOrphanFiles(
    olderThanHours = 2,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    if (
      typeof olderThanHours !== 'number' ||
      !Number.isFinite(olderThanHours) ||
      olderThanHours < 0
    ) {
      throw new BadRequestException(
        'Параметр hours должен быть неотрицательным числом',
      );
    }

    const query = `
      UPDATE files f
      SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE f.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM employee_passport_files epf
          WHERE epf.file_id = f.id
        )
        AND f.created_at <= (CURRENT_TIMESTAMP - ($1 * INTERVAL '1 hour'))
      RETURNING f.id
    `;

    const res = await this.pool.query(query, [olderThanHours]);
    const deletedIds: string[] = res.rows.map((row: { id: string }) => row.id);

    if (deletedIds.length > 0) {
      this.logger.log(`Мягко очищено непривязанных файлов: ${deletedIds.length}`);
    }

    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }
}