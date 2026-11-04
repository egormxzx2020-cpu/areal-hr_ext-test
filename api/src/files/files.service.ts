import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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
export class FilesService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  /**
   * Сохранение метаданных загруженного файла в таблицу files
   */
  async saveFile(file: Express.Multer.File): Promise<Omit<FileRecord, 'file_path' | 'deleted_at'>> {
    // Декодируем оригинальное имя файла для поддержки кириллицы
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
   * Получение метаданных файла по ID (с проверкой на deleted_at)
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
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [current.id],
    );

    return { success: true, id: current.id };
  }
}