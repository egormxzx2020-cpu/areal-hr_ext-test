import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CreatePositionDto, UpdatePositionDto } from './positions.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PositionsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    const res = await this.pool.query(
      `SELECT id, name, created_at, updated_at, deleted_at 
       FROM positions 
       ORDER BY (deleted_at IS NOT NULL), created_at DESC`,
    );
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT id, name, created_at, updated_at, deleted_at 
       FROM positions 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
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
       RETURNING id, name, created_at, updated_at, deleted_at`,
      [dto.name],
    );
    const created = res.rows[0];

    await this.auditService.logChange({
      entityType: 'Position',
      entityId: created.id,
      changedFields: this.auditService.calculateDiff(null, { name: created.name }),
    });

    return created;
  }

  async update(id: string, dto: UpdatePositionDto) {
    const current = await this.findOne(id);

    const res = await this.pool.query(
      `UPDATE positions 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND deleted_at IS NULL 
       RETURNING id, name, created_at, updated_at, deleted_at`,
      [dto.name, id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Должность с ID ${id} не найдена`);
    }
    const updated = res.rows[0];

    const diff = this.auditService.calculateDiff(
      { name: current.name },
      { name: updated.name },
    );

    if (Object.keys(diff).length > 0) {
      await this.auditService.logChange({
        entityType: 'Position',
        entityId: id,
        changedFields: diff,
      });
    }

    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

    const res = await this.pool.query(
      `UPDATE positions 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL 
       RETURNING id, deleted_at`,
      [id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Должность с ID ${id} не найдена`);
    }

    await this.auditService.logChange({
      entityType: 'Position',
      entityId: id,
      changedFields: {
        deleted_at: { old: current.deleted_at, new: res.rows[0].deleted_at },
      },
    });

    return { success: true, id };
  }
}