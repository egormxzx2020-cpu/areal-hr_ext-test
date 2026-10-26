import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';
import { CreatePositionDto, UpdatePositionDto } from './positions.dto';

@Injectable()
export class PositionsService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAll() {
    const res = await this.pool.query(
      `SELECT id, name, created_at, updated_at 
       FROM positions 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`
    );
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT id, name, created_at, updated_at 
       FROM positions 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Должность с ID ${id} не найдена`);
    }
    return res.rows[0];
  }

  async create(dto: CreatePositionDto) {
    const res = await this.pool.query(
      `INSERT INTO positions (name) 
       VALUES ($1) 
       RETURNING id, name, created_at, updated_at`,
      [dto.name]
    );
    return res.rows[0];
  }

  async update(id: string, dto: UpdatePositionDto) {
    const res = await this.pool.query(
      `UPDATE positions 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND deleted_at IS NULL 
       RETURNING id, name, created_at, updated_at`,
      [dto.name, id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Должность с ID ${id} не найдена`);
    }
    return res.rows[0];
  }

  async remove(id: string) {
    // Мягкое удаление (Soft Delete) по требованию ТЗ
    const res = await this.pool.query(
      `UPDATE positions 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL 
       RETURNING id`,
      [id]
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Должность с ID ${id} не найдена`);
    }
    return { success: true, id };
  }
}