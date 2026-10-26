import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';
import { CreateDepartmentDto, UpdateDepartmentDto } from './departments.dto';

@Injectable()
export class DepartmentsService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAll(organizationId?: string) {
    let query = `
      SELECT 
        d.id, 
        d.organization_id, 
        o.name AS organization_name,
        d.parent_id, 
        p.name AS parent_name,
        d.name, 
        d.comment, 
        d.created_at, 
        d.updated_at 
      FROM departments d
      JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN departments p ON p.id = d.parent_id
      WHERE d.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (organizationId) {
      params.push(organizationId);
      query += ` AND d.organization_id = $1`;
    }

    query += ` ORDER BY d.created_at DESC`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT d.*, o.name AS organization_name, p.name AS parent_name
       FROM departments d
       JOIN organizations o ON o.id = d.organization_id
       LEFT JOIN departments p ON p.id = d.parent_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return res.rows[0];
  }

  async create(dto: CreateDepartmentDto) {
    // Проверяем, существует ли указанная организация
    const orgRes = await this.pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [dto.organization_id]
    );
    if (!orgRes.rows[0]) {
      throw new BadRequestException('Указанная организация не найдена или удалена');
    }

    const parentId = dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;

    const res = await this.pool.query(
      `INSERT INTO departments (organization_id, parent_id, name, comment) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null]
    );
    return res.rows[0];
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    if (id === dto.parent_id) {
      throw new BadRequestException('Отдел не может быть родительским сам для себя');
    }

    const parentId = dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;

    const res = await this.pool.query(
      `UPDATE departments 
       SET organization_id = $1, parent_id = $2, name = $3, comment = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 AND deleted_at IS NULL 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null, id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return res.rows[0];
  }

  async remove(id: string) {
    const res = await this.pool.query(
      `UPDATE departments 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL 
       RETURNING id`,
      [id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return { success: true, id };
  }
}