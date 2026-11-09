import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employees.dto';

@Injectable()
export class EmployeesService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAll(search?: string) {
    let query = `
      SELECT 
        e.id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.birth_date,
        e.passport_series,
        e.passport_number,
        e.passport_issue_date,
        e.passport_department_code,
        e.passport_issued_by,
        e.reg_region,
        e.reg_city,
        e.reg_street,
        e.reg_house,
        e.reg_building,
        e.reg_apartment,
        e.created_at,
        e.updated_at,
        e.deleted_at,
        COUNT(f.id) FILTER (WHERE f.id IS NOT NULL AND f.deleted_at IS NULL)::int AS files_count
      FROM employees e
      LEFT JOIN employee_passport_files epf ON epf.employee_id = e.id
      LEFT JOIN files f ON f.id = epf.file_id AND f.deleted_at IS NULL
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        e.last_name ILIKE $1 OR 
        e.first_name ILIKE $1 OR 
        e.passport_number ILIKE $1
      )`;
    }

    query += `
      GROUP BY e.id
      ORDER BY (e.deleted_at IS NOT NULL), e.created_at DESC
    `;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findOne(id: string) {
    const query = `
      SELECT 
        e.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.id,
              'name', f.name,
              'mime_type', f.mime_type,
              'size', f.size,
              'created_at', f.created_at
            )
          ) FILTER (WHERE f.id IS NOT NULL AND f.deleted_at IS NULL),
          '[]'
        ) AS passport_files
      FROM employees e
      LEFT JOIN employee_passport_files epf ON epf.employee_id = e.id
      LEFT JOIN files f ON f.id = epf.file_id AND f.deleted_at IS NULL
      WHERE e.id = $1
      GROUP BY e.id
    `;

    const res = await this.pool.query(query, [id]);
    if (!res.rows[0]) {
      throw new NotFoundException(`Сотрудник с ID ${id} не найден`);
    }

    return res.rows[0];
  }

  async create(dto: CreateEmployeeDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Проверка существования и неудаленности прикрепляемых файлов
      if (dto.file_ids && dto.file_ids.length > 0) {
        await this.validateFileIds(dto.file_ids, client);
      }

      const insertQuery = `
        INSERT INTO employees (
          last_name, first_name, middle_name, birth_date,
          passport_series, passport_number, passport_issue_date,
          passport_department_code, passport_issued_by,
          reg_region, reg_city, reg_street, reg_house, reg_building, reg_apartment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `;

      const values = [
        dto.last_name,
        dto.first_name,
        dto.middle_name || null,
        dto.birth_date,
        dto.passport_series,
        dto.passport_number,
        dto.passport_issue_date,
        dto.passport_department_code,
        dto.passport_issued_by,
        dto.reg_region,
        dto.reg_city,
        dto.reg_street,
        dto.reg_house,
        dto.reg_building || null,
        dto.reg_apartment || null,
      ];

      const empRes = await client.query(insertQuery, values);
      const employeeId = empRes.rows[0].id;

      if (dto.file_ids && dto.file_ids.length > 0) {
        for (const fileId of dto.file_ids) {
          await client.query(
            `INSERT INTO employee_passport_files (employee_id, file_id) 
             VALUES ($1, $2) 
             ON CONFLICT DO NOTHING`,
            [employeeId, fileId],
          );
        }
      }

      await client.query('COMMIT');
      return this.findOne(employeeId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const current = await this.findOne(id);
    if (current.deleted_at) {
      throw new BadRequestException('Нельзя редактировать удаленного сотрудника');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Проверка существования и неудаленности прикрепляемых файлов при обновлении
      if (dto.file_ids && dto.file_ids.length > 0) {
        await this.validateFileIds(dto.file_ids, client);
      }

      const updateQuery = `
        UPDATE employees SET
          last_name = $1, first_name = $2, middle_name = $3, birth_date = $4,
          passport_series = $5, passport_number = $6, passport_issue_date = $7,
          passport_department_code = $8, passport_issued_by = $9,
          reg_region = $10, reg_city = $11, reg_street = $12, reg_house = $13,
          reg_building = $14, reg_apartment = $15, updated_at = CURRENT_TIMESTAMP
        WHERE id = $16 AND deleted_at IS NULL
      `;

      const values = [
        dto.last_name,
        dto.first_name,
        dto.middle_name || null,
        dto.birth_date,
        dto.passport_series,
        dto.passport_number,
        dto.passport_issue_date,
        dto.passport_department_code,
        dto.passport_issued_by,
        dto.reg_region,
        dto.reg_city,
        dto.reg_street,
        dto.reg_house,
        dto.reg_building || null,
        dto.reg_apartment || null,
        id,
      ];

      await client.query(updateQuery, values);

      if (dto.file_ids !== undefined) {
        await client.query(
          `DELETE FROM employee_passport_files WHERE employee_id = $1`,
          [id],
        );
        for (const fileId of dto.file_ids) {
          await client.query(
            `INSERT INTO employee_passport_files (employee_id, file_id) 
             VALUES ($1, $2) 
             ON CONFLICT DO NOTHING`,
            [id, fileId],
          );
        }
      }

      await client.query('COMMIT');
      return this.findOne(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    const current = await this.findOne(id);
    if (current.deleted_at) {
      throw new NotFoundException(`Сотрудник с ID ${id} уже удален`);
    }

    const res = await this.pool.query(
      `UPDATE employees 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL 
       RETURNING id`,
      [id],
    );

    if (!res.rows[0]) {
      throw new NotFoundException(`Сотрудник с ID ${id} не найден или уже удален`);
    }

    return { success: true, id: res.rows[0].id };
  }

  /**
   * Валидация списка файлов: файлы обязаны существовать в таблице files и иметь deleted_at IS NULL
   */
  private async validateFileIds(fileIds: string[], client?: PoolClient): Promise<void> {
    const uniqueIds = Array.from(new Set(fileIds));
    const runner = client || this.pool;

    const res = await runner.query(
      `SELECT id FROM files WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [uniqueIds],
    );

    if (res.rows.length !== uniqueIds.length) {
      const foundIds = new Set(res.rows.map((r: { id: string }) => r.id));
      const missingOrDeleted = uniqueIds.filter((fid) => !foundIds.has(fid));
      throw new BadRequestException(
        `Файлы со следующими ID не найдены или удалены: ${missingOrDeleted.join(', ')}`,
      );
    }
  }
}