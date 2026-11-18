import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CreatePersonnelActionDto } from './personnel-actions.dto';
import { AuditService } from '../audit/audit.service';

export interface EmployeeCurrentState {
  status: 'not_hired' | 'employed' | 'fired';
  department_id: string | null;
  department_name: string | null;
  position_id: string | null;
  position_name: string | null;
  salary: number | null;
  last_action_date: string | null;
}

@Injectable()
export class PersonnelActionsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Получение истории активных кадровых приказов сотрудника
   */
  async findByEmployee(employeeId: string) {
    const query = `
      SELECT 
        pa.id,
        pa.employee_id,
        pa.action_type,
        pa.department_id,
        d.name AS department_name,
        pa.position_id,
        pos.name AS position_name,
        pa.salary,
        pa.action_date,
        pa.created_at,
        pa.updated_at,
        pa.deleted_at
      FROM personnel_actions pa
      LEFT JOIN departments d ON d.id = pa.department_id
      LEFT JOIN positions pos ON pos.id = pa.position_id
      WHERE pa.employee_id = $1 AND pa.deleted_at IS NULL
      ORDER BY pa.action_date DESC, pa.created_at DESC
    `;

    const res = await this.pool.query(query, [employeeId]);
    return res.rows;
  }

  /**
   * Вычисление актуального кадрового среза сотрудника по последнему активному приказу
   */
  async getEmployeeCurrentState(
    employeeId: string,
    client?: PoolClient,
  ): Promise<EmployeeCurrentState> {
    const runner = client || this.pool;
    const query = `
      SELECT 
        pa.action_type,
        pa.department_id,
        d.name AS department_name,
        pa.position_id,
        pos.name AS position_name,
        pa.salary,
        pa.action_date
      FROM personnel_actions pa
      LEFT JOIN departments d ON d.id = pa.department_id AND d.deleted_at IS NULL
      LEFT JOIN positions pos ON pos.id = pa.position_id AND pos.deleted_at IS NULL
      WHERE pa.employee_id = $1 AND pa.deleted_at IS NULL
      ORDER BY pa.action_date DESC, pa.created_at DESC
      LIMIT 1
    `;

    const res = await runner.query(query, [employeeId]);
    const lastAction = res.rows[0];

    if (!lastAction) {
      return {
        status: 'not_hired',
        department_id: null,
        department_name: null,
        position_id: null,
        position_name: null,
        salary: null,
        last_action_date: null,
      };
    }

    if (lastAction.action_type === 'fire') {
      return {
        status: 'fired',
        department_id: null,
        department_name: null,
        position_id: null,
        position_name: null,
        salary: null,
        last_action_date: lastAction.action_date,
      };
    }

    return {
      status: 'employed',
      department_id: lastAction.department_id ?? null,
      department_name: lastAction.department_name ?? null,
      position_id: lastAction.position_id ?? null,
      position_name: lastAction.position_name ?? null,
      salary:
        lastAction.salary !== null && lastAction.salary !== undefined
          ? Number(lastAction.salary)
          : null,
      last_action_date: lastAction.action_date,
    };
  }

  /**
   * Проведение кадрового приказа в транзакции с блокировкой строки сотрудника (FOR UPDATE)
   */
  async create(dto: CreatePersonnelActionDto, userId?: string | null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const empRes = await client.query(
        `SELECT id, birth_date, deleted_at FROM employees WHERE id = $1 FOR UPDATE`,
        [dto.employee_id],
      );
      const employee = empRes.rows[0];

      if (!employee) {
        throw new NotFoundException(`Сотрудник с ID ${dto.employee_id} не найден`);
      }

      if (employee.deleted_at) {
        throw new BadRequestException(
          'Нельзя оформить кадровый приказ для удаленного сотрудника',
        );
      }

      if (dto.action_date < employee.birth_date) {
        throw new BadRequestException(
          'Дата кадрового действия не может быть раньше даты рождения сотрудника',
        );
      }

      const currentState = await this.getEmployeeCurrentState(
        dto.employee_id,
        client,
      );

      let finalDepartmentId: string | null = null;
      let finalPositionId: string | null = null;
      let finalSalary: number | null = null;

      if (dto.action_type === 'hire') {
        if (currentState.status === 'employed') {
          throw new BadRequestException(
            'Сотрудник уже трудоустроен. Для смены подразделения оформите перевод',
          );
        }

        await this.validateDepartmentAndPosition(
          dto.department_id!,
          dto.position_id!,
          client,
        );

        finalDepartmentId = dto.department_id!;
        finalPositionId = dto.position_id!;
        finalSalary = dto.salary!;
      } else {
        if (currentState.status !== 'employed') {
          throw new BadRequestException(
            'Данное действие доступно только для работающего сотрудника',
          );
        }

        if (
          currentState.last_action_date &&
          dto.action_date < currentState.last_action_date
        ) {
          throw new BadRequestException(
            'Дата приказа не может быть раньше даты последней кадровой операции',
          );
        }

        if (dto.action_type === 'transfer_dept') {
          await this.validateDepartmentAndPosition(
            dto.department_id!,
            dto.position_id!,
            client,
          );

          finalDepartmentId = dto.department_id!;
          finalPositionId = dto.position_id!;
          finalSalary =
            dto.salary !== undefined && dto.salary !== null
              ? dto.salary
              : currentState.salary;
        } else if (dto.action_type === 'change_salary') {
          finalDepartmentId = currentState.department_id;
          finalPositionId = currentState.position_id;
          finalSalary = dto.salary!;
        } else if (dto.action_type === 'fire') {
          finalDepartmentId = null;
          finalPositionId = null;
          finalSalary = null;
        }
      }

      const insertRes = await client.query(
        `
        INSERT INTO personnel_actions (
          employee_id, action_type, department_id, position_id, salary, action_date
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, employee_id, action_type, department_id, position_id, salary, action_date, created_at, updated_at, deleted_at
        `,
        [
          dto.employee_id,
          dto.action_type,
          finalDepartmentId,
          finalPositionId,
          finalSalary,
          dto.action_date,
        ],
      );

      const created = insertRes.rows[0];

      await this.auditService.logChange({
        entityType: 'PersonnelAction',
        entityId: created.id,
        changedFields: this.auditService.calculateDiff(null, {
          employee_id: created.employee_id,
          action_type: created.action_type,
          department_id: created.department_id,
          position_id: created.position_id,
          salary: created.salary,
          action_date: created.action_date,
        }),
        userId: userId ?? null,
        client,
      });

      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Мягкое удаление последнего кадрового приказа в цепочке сотрудника
   */
  async remove(id: string, userId?: string | null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const targetRes = await client.query(
        `
        SELECT id, employee_id, action_type, action_date, created_at, deleted_at
        FROM personnel_actions
        WHERE id = $1 AND deleted_at IS NULL
        `,
        [id],
      );
      const target = targetRes.rows[0];

      if (!target) {
        throw new NotFoundException(`Кадровый приказ с ID ${id} не найден`);
      }

      await client.query(
        `SELECT id FROM employees WHERE id = $1 FOR UPDATE`,
        [target.employee_id],
      );

      const newerRes = await client.query(
        `
        SELECT id, action_type, action_date
        FROM personnel_actions
        WHERE employee_id = $1
          AND deleted_at IS NULL
          AND id <> $2
          AND (
            action_date > $3
            OR (action_date = $3 AND created_at > $4)
          )
        LIMIT 1
        `,
        [target.employee_id, id, target.action_date, target.created_at],
      );

      if (newerRes.rows.length > 0) {
        throw new ConflictException(
          'Невозможно удалить приказ, так как после него существуют более поздние кадровые операции',
        );
      }

      const deleteRes = await client.query(
        `
        UPDATE personnel_actions
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, deleted_at
        `,
        [id],
      );

      await this.auditService.logChange({
        entityType: 'PersonnelAction',
        entityId: id,
        changedFields: {
          deleted_at: {
            old: target.deleted_at,
            new: deleteRes.rows[0].deleted_at,
          },
        },
        userId: userId ?? null,
        client,
      });

      await client.query('COMMIT');
      return { success: true, id: deleteRes.rows[0].id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Проверка существования активных подразделения и должности
   */
  private async validateDepartmentAndPosition(
    departmentId: string,
    positionId: string,
    client: PoolClient,
  ): Promise<void> {
    const deptRes = await client.query(
      `SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
      [departmentId],
    );
    if (!deptRes.rows[0]) {
      throw new BadRequestException(
        'Указанное подразделение не найдено или удалено',
      );
    }

    const posRes = await client.query(
      `SELECT id FROM positions WHERE id = $1 AND deleted_at IS NULL`,
      [positionId],
    );
    if (!posRes.rows[0]) {
      throw new BadRequestException(
        'Указанная должность не найдена или удалена',
      );
    }
  }
}