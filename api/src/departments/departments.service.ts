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
       WHERE d.id = $1`,
      [id],
    );
    if (!res.rows[0]) {
      throw new NotFoundException(`Отдел с ID ${id} не найден`);
    }
    return res.rows[0];
  }

  async create(dto: CreateDepartmentDto) {
    await this.validateOrganization(dto.organization_id);

    const parentId = dto.parent_id || null;
    if (parentId) {
      await this.validateParent(parentId, dto.organization_id);
    }

    const res = await this.pool.query(
      `INSERT INTO departments (organization_id, parent_id, name, comment) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null],
    );
    return res.rows[0];
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const currentDept = await this.findOne(id);
    if (currentDept.deleted_at) {
      throw new BadRequestException('Нельзя редактировать удаленный отдел');
    }

    await this.validateOrganization(dto.organization_id);

    // Если организация изменилась, проверяем, нет ли активных дочерних отделов
    if (currentDept.organization_id !== dto.organization_id) {
      const children = await this.pool.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      if (children.rowCount && children.rowCount > 0) {
        throw new BadRequestException(
          'Нельзя сменить организацию у отдела, имеющего дочерние подразделения. Сначала переместите или удалите дочерние отделы.',
        );
      }
    }

    const parentId = dto.parent_id || null;
    if (parentId) {
      if (id === parentId) {
        throw new BadRequestException('Отдел не может быть родительским сам для себя');
      }
      await this.validateParent(parentId, dto.organization_id);
      await this.assertNoCycle(id, parentId);
    }

    const res = await this.pool.query(
      `UPDATE departments 
       SET organization_id = $1, parent_id = $2, name = $3, comment = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 AND deleted_at IS NULL 
       RETURNING id, organization_id, parent_id, name, comment, created_at, updated_at`,
      [dto.organization_id, parentId, dto.name, dto.comment || null, id],
    );
    return res.rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);

    // Выполняем проверку и удаление в атомарной транзакции
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const childDepts = await client.query(
        `SELECT 1 FROM departments WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [id],
      );
      if (childDepts.rowCount && childDepts.rowCount > 0) {
        throw new ConflictException(
          'Невозможно удалить отдел: у него есть дочерние подразделения. Сначала удалите или переместите их.',
        );
      }

      const res = await client.query(
        `UPDATE departments 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND deleted_at IS NULL 
         RETURNING id`,
        [id],
      );

      await client.query('COMMIT');
      return { success: true, id: res.rows[0].id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async validateOrganization(orgId: string): Promise<void> {
    const res = await this.pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!res.rows[0]) {
      throw new BadRequestException('Указанная организация не найдена или удалена');
    }
  }

  private async validateParent(parentId: string, orgId: string): Promise<void> {
    const res = await this.pool.query(
      `SELECT id, organization_id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
      [parentId],
    );
    const parent = res.rows[0];
    if (!parent) {
      throw new BadRequestException('Указанный родительский отдел не найден или удален');
    }
    if (parent.organization_id !== orgId) {
      throw new BadRequestException('Родительский отдел обязан принадлежать той же организации');
    }
  }

  private async assertNoCycle(currentDeptId: string, targetParentId: string): Promise<void> {
    const cycleCheck = await this.pool.query(
      `
      WITH RECURSIVE descendants AS (
        SELECT id FROM departments WHERE parent_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT d.id FROM departments d
        JOIN descendants desc_list ON d.parent_id = desc_list.id
        WHERE d.deleted_at IS NULL
      )
      SELECT id FROM descendants WHERE id = $2 LIMIT 1;
      `,
      [currentDeptId, targetParentId],
    );

    if (cycleCheck.rowCount && cycleCheck.rowCount > 0) {
      throw new BadRequestException(
        'Нельзя назначить родительским подразделение, которое уже является дочерним для данного отдела (обнаружено циклическое замыкание)',
      );
    }
  }
}