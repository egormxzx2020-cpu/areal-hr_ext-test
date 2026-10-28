import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAll() {
    const res = await this.pool.query(
      `SELECT id, name, comment, created_at, updated_at 
       FROM organizations 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`,
    );
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT id, name, comment, created_at, updated_at 
       FROM organizations 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Организация с ID ${id} не найдена`);
    }
    return res.rows[0];
  }

  async create(dto: CreateOrganizationDto) {
    const res = await this.pool.query(
      `INSERT INTO organizations (name, comment) 
       VALUES ($1, $2) 
       RETURNING id, name, comment, created_at, updated_at`,
      [dto.name, dto.comment || null],
    );
    return res.rows[0];
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const res = await this.pool.query(
      `UPDATE organizations 
       SET name = $1, comment = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 AND deleted_at IS NULL 
       RETURNING id, name, comment, created_at, updated_at`,
      [dto.name, dto.comment || null, id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Организация с ID ${id} не найдена`);
    }
    return res.rows[0];
  }

  async remove(id: string) {
    // 1. Проверяем, существует ли организация
    await this.findOne(id);

    // 2. Защита: нельзя удалить организацию, если в ней есть неудаленные отделы (409 Conflict)
    const childDepts = await this.pool.query(
      `SELECT 1 FROM departments WHERE organization_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (childDepts.rowCount && childDepts.rowCount > 0) {
      throw new ConflictException(
        'Невозможно удалить организацию: в ней числятся активные подразделения. Сначала удалите или переместите отделы.',
      );
    }

    const res = await this.pool.query(
      `UPDATE organizations 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL 
       RETURNING id`,
      [id],
    );
    return { success: true, id: res.rows[0].id };
  }
}