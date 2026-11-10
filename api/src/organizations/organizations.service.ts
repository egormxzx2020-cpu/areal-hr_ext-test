import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    const res = await this.pool.query(
      `SELECT id, name, comment, created_at, updated_at, deleted_at 
       FROM organizations 
       ORDER BY (deleted_at IS NOT NULL), created_at DESC`,
    );
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT id, name, comment, created_at, updated_at, deleted_at 
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
       RETURNING id, name, comment, created_at, updated_at, deleted_at`,
      [dto.name, dto.comment || null],
    );
    const created = res.rows[0];

    await this.auditService.logChange({
      entityType: 'Organization',
      entityId: created.id,
      changedFields: this.auditService.calculateDiff(null, {
        name: created.name,
        comment: created.comment,
      }),
    });

    return created;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const current = await this.findOne(id);

    const res = await this.pool.query(
      `UPDATE organizations 
       SET name = $1, comment = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 AND deleted_at IS NULL 
       RETURNING id, name, comment, created_at, updated_at, deleted_at`,
      [dto.name, dto.comment || null, id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Организация с ID ${id} не найдена`);
    }
    const updated = res.rows[0];

    const diff = this.auditService.calculateDiff(
      { name: current.name, comment: current.comment },
      { name: updated.name, comment: updated.comment },
    );

    if (Object.keys(diff).length > 0) {
      await this.auditService.logChange({
        entityType: 'Organization',
        entityId: id,
        changedFields: diff,
      });
    }

    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

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
       RETURNING id, deleted_at`,
      [id],
    );

    await this.auditService.logChange({
      entityType: 'Organization',
      entityId: id,
      changedFields: {
        deleted_at: { old: current.deleted_at, new: res.rows[0].deleted_at },
      },
    });

    return { success: true, id: res.rows[0].id };
  }
}