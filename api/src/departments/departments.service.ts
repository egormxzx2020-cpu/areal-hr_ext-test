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
      JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN departments p ON p.id = d.parent_id
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
       JOIN organizations o ON o.id = d.organization_id
       LEFT JOIN departments p ON p.id = d.parent_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return res.rows[0];
  }

  async create(dto: CreateDepartmentDto, userId?: string | null) {
    const orgRes = await this.pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [dto.organization_id],
    );
    if (!orgRes.rows[0]) {
      throw new BadRequestException('Указанная организация не найдена или удалена');
    }

    const parentId =
      dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;

    if (parentId) {
      const parentRes = await this.pool.query(
        `SELECT id, organization_id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
        [parentId],
      );
      if (!parentRes.rows[0]) {
        throw new BadRequestException('Указанный родительский отдел не найден');
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
      userId: userId ?? null,
    });

    return created;
  }

  async update(id: string, dto: UpdateDepartmentDto, userId?: string | null) {
    const current = await this.findOne(id);

    const orgRes = await this.pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [dto.organization_id],
    );
    if (!orgRes.rows[0]) {
      throw new BadRequestException('Указанная организация не найдена или удалена');
    }

    if (dto.organization_id !== current.organization_id) {
      const childrenRes = await this.pool.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (childrenRes.rowCount && childrenRes.rowCount > 0) {
        throw new ConflictException(
          'Невозможно изменить организацию у отдела с активными дочерними подразделениями',
        );
      }
    }

    const parentId =
      dto.parent_id && dto.parent_id.trim() !== '' ? dto.parent_id : null;

    if (parentId) {
      if (parentId === id) {
        throw new BadRequestException('Отдел не может быть родительским сам для себя');
      }

      const parentRes = await this.pool.query(
        `SELECT id, organization_id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
        [parentId],
      );
      if (!parentRes.rows[0]) {
        throw new BadRequestException('Указанный родительский отдел не найден');
      }
      if (parentRes.rows[0].organization_id !== dto.organization_id) {
        throw new BadRequestException(
          'Родительский отдел должен принадлежать той же организации',
        );
      }

      // Рекурсивная проверка отсутствия циклов (A -> B -> ... -> A)
      const cycleCheck = await this.pool.query(
        `
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id FROM departments WHERE id = $1 AND deleted_at IS NULL
          UNION ALL
          SELECT d.id, d.parent_id
          FROM departments d
          INNER JOIN ancestors a ON d.id = a.parent_id
          WHERE d.deleted_at IS NULL
        )
        SELECT id FROM ancestors WHERE id = $2 LIMIT 1
        `,
        [parentId, id],
      );

      if (cycleCheck.rowCount && cycleCheck.rowCount > 0) {
        throw new BadRequestException(
          'Обнаружена циклическая зависимость в иерархии отделов',
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
        userId: userId ?? null,
      });
    }

    return updated;
  }

  async remove(id: string, userId?: string | null) {
    const current = await this.findOne(id);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const childDepts = await client.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (childDepts.rowCount && childDepts.rowCount > 0) {
        throw new ConflictException(
          'Невозможно удалить отдел, так как у него есть активные дочерние подразделения',
        );
      }

      const actionsUsage = await client.query(
        `SELECT 1 FROM personnel_actions WHERE department_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (actionsUsage.rowCount && actionsUsage.rowCount > 0) {
        throw new ConflictException(
          'Невозможно удалить отдел, так как он используется в кадровых приказах',
        );
      }

      const res = await client.query(
        `UPDATE departments 
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL 
         RETURNING id, deleted_at`,
        [id],
      );

      await this.auditService.logChange({
        entityType: 'Department',
        entityId: id,
        changedFields: {
          deleted_at: { old: current.deleted_at, new: res.rows[0].deleted_at },
        },
        userId: userId ?? null,
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