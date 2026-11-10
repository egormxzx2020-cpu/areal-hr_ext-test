import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
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
    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanFiles(2).catch((err) => {
        this.logger.error(
          'Ошибка автоматической фоновой очистки файлов:',
          err?.stack || err,
        );
      });
    }, 60 * 60 * 1000);

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

  async softDelete(id: string): Promise<{ success: boolean; id: string }> {
    const current = await this.findById(id);

    await this.pool.query(
      `UPDATE files
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [current.id],
    );

    return { success: true, id: current.id };
  }

  /**
   * Удаление физического файла с диска
   */
  async deletePhysicalFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err: any) {
      this.logger.warn(
        `Не удалось удалить физический файл ${filePath}: ${err?.message || err}`,
      );
    }
  }

  /**
   * Очистка непривязанных (осиротевших) файлов с диска и из БД
   */
  async cleanupOrphanFiles(
    olderThanHours = 2,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    const hours = Math.max(0, Number(olderThanHours) || 0);

    const query = `
      SELECT f.id, f.file_path
      FROM files f
      WHERE NOT EXISTS (
        SELECT 1 
        FROM employee_passport_files epf 
        WHERE epf.file_id = f.id
      )
      AND f.created_at <= (CURRENT_TIMESTAMP - ($1 || ' hours')::interval)
    `;

    const res = await this.pool.query(query, [hours]);
    const orphanFiles: Array<{ id: string; file_path: string }> = res.rows;

    if (orphanFiles.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }

    const deletedIds: string[] = [];

    for (const file of orphanFiles) {
      await this.deletePhysicalFile(file.file_path);
      deletedIds.push(file.id);
    }

    await this.pool.query(
      `DELETE FROM files WHERE id = ANY($1::uuid[])`,
      [deletedIds],
    );

    this.logger.log(`Очищено непривязанных файлов: ${deletedIds.length}`);

    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }
}