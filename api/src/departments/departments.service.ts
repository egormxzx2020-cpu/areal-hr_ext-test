import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CreateDepartmentDto, UpdateDepartmentDto } from './departments.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

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
        d.updated_at,
        d.deleted_at
      FROM departments d
      JOIN organizations o ON o.id = d.organization_id AND o.deleted_at IS NULL
      LEFT JOIN departments p ON p.id = d.parent_id AND p.deleted_at IS NULL
      WHERE 1=1
    `;
    const params: any[] = [];

    if (organizationId) {
      params.push(organizationId);
      query += ` AND d.organization_id = $1`;
    }

    query += ` ORDER BY (d.deleted_at IS NOT NULL), d.created_at DESC`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findOne(id: string) {
    const res = await this.pool.query(
      `SELECT d.*, o.name AS organization_name, p.name AS parent_name
       FROM departments d
       JOIN organizations o ON o.id = d.organization_id AND o.deleted_at IS NULL
       LEFT JOIN departments p ON p.id = d.parent_id AND p.deleted_at IS NULL
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return res.rows[0];
  }

  async create(dto: CreateDepartmentDto) {
    const orgRes = await this.pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [dto.organization_id],
    );
    if (!orgRes.rows[0]) {
      throw new BadRequestException('Указанная организация не найдена или удалена');
    }

    const parentId = dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;
    if (parentId) {
      const parentRes = await this.pool.query(
        `SELECT id, organization_id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
        [parentId],
      );
      if (!parentRes.rows[0]) {
        throw new BadRequestException('Родительский отдел не найден или удален');
      }
      if (parentRes.rows[0].organization_id !== dto.organization_id) {
        throw new BadRequestException(
          'Родительский отдел должен принадлежать той же организации',
        );
      }
    }

    const res = await this.pool.query(
      `INSERT INTO departments (organization_id, parent_id, name, comment) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at, deleted_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null],
    );
    const created = res.rows[0];

    await this.auditService.logChange({
      entityType: 'Department',
      entityId: created.id,
      changedFields: this.auditService.calculateDiff(null, {
        organization_id: created.organization_id,
        parent_id: created.parent_id,
        name: created.name,
        comment: created.comment,
      }),
    });

    return created;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const current = await this.findOne(id);
    const parentId = dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;

    if (id === parentId) {
      throw new BadRequestException('Отдел не может быть родительским сам для себя');
    }

    if (parentId) {
      const parentRes = await this.pool.query(
        `SELECT id, organization_id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
        [parentId],
      );
      if (!parentRes.rows[0]) {
        throw new BadRequestException('Родительский отдел не найден или удален');
      }
      if (parentRes.rows[0].organization_id !== dto.organization_id) {
        throw new BadRequestException(
          'Родительский отдел должен принадлежать той же организации',
        );
      }

      const cycleQuery = `
        WITH RECURSIVE dept_path AS (
          SELECT id, parent_id FROM departments WHERE id = $1 AND deleted_at IS NULL
          UNION ALL
          SELECT d.id, d.parent_id FROM departments d
          JOIN dept_path p ON d.id = p.parent_id
          WHERE d.deleted_at IS NULL
        )
        SELECT 1 FROM dept_path WHERE id = $2 LIMIT 1;
      `;
      const cycleCheck = await this.pool.query(cycleQuery, [parentId, id]);
      if (cycleCheck.rowCount && cycleCheck.rowCount > 0) {
        throw new BadRequestException(
          'Циклическая зависимость: выбранный родительский отдел является потомком текущего отдела',
        );
      }
    }

    if (current.organization_id !== dto.organization_id) {
      const childrenCheck = await this.pool.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (childrenCheck.rowCount && childrenCheck.rowCount > 0) {
        throw new BadRequestException(
          'Нельзя перенести отдел в другую организацию, пока у него есть дочерние отделы',
        );
      }
    }

    const res = await this.pool.query(
      `UPDATE departments 
       SET organization_id = $1, parent_id = $2, name = $3, comment = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 AND deleted_at IS NULL 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at, deleted_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null, id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    const updated = res.rows[0];

    const diff = this.auditService.calculateDiff(
      {
        organization_id: current.organization_id,
        parent_id: current.parent_id,
        name: current.name,
        comment: current.comment,
      },
      {
        organization_id: updated.organization_id,
        parent_id: updated.parent_id,
        name: updated.name,
        comment: updated.comment,
      },
    );

    if (Object.keys(diff).length > 0) {
      await this.auditService.logChange({
        entityType: 'Department',
        entityId: id,
        changedFields: diff,
      });
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const childDepts = await client.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (childDepts.rowCount && childDepts.rowCount > 0) {
        throw new ConflictException(
          'Невозможно удалить отдел: он содержит активные дочерние подразделения. Сначала удалите или переместите их.',
        );
      }

      const res = await client.query(
        `UPDATE departments 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND deleted_at IS NULL 
         RETURNING id, deleted_at`,
        [id],
      );

      await this.auditService.logChange({
        entityType: 'Department',
        entityId: id,
        changedFields: {
          deleted_at: { old: null, new: res.rows[0].deleted_at },
        },
        client,
      });

      await client.query('COMMIT');
      return { success: true, id: res.rows[0].id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}