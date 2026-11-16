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

export interface EmployeeCurrentStatus {
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
   * Получение текущего кадрового состояния сотрудника (поддерживает работу внутри транзакции)
   */
  async getEmployeeCurrentState(
    employeeId: string,
    client?: PoolClient,
  ): Promise<EmployeeCurrentStatus> {
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
    if (!res.rows[0]) {
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

    const last = res.rows[0];
    if (last.action_type === 'fire') {
      return {
        status: 'fired',
        department_id: null,
        department_name: null,
        position_id: null,
        position_name: null,
        salary: null,
        last_action_date: last.action_date,
      };
    }

    return {
      status: 'employed',
      department_id: last.department_id,
      department_name: last.department_name,
      position_id: last.position_id,
      position_name: last.position_name,
      salary: last.salary ? Number(last.salary) : null,
      last_action_date: last.action_date,
    };
  }

  /**
   * Получение полной хронологии кадровых перемещений сотрудника
   */
  async findByEmployee(employeeId: string) {
    const empCheck = await this.pool.query(
      `SELECT id FROM employees WHERE id = $1 AND deleted_at IS NULL`,
      [employeeId],
    );
    if (!empCheck.rows[0]) {
      throw new NotFoundException(`Сотрудник с ID ${employeeId} не найден`);
    }

    const query = `
      SELECT 
        pa.id,
        pa.employee_id,
        pa.action_type,
        pa.department_id,
        d.name AS department_name,
        o.name AS organization_name,
        pa.position_id,
        pos.name AS position_name,
        pa.salary,
        pa.action_date,
        pa.created_at,
        pa.updated_at
      FROM personnel_actions pa
      LEFT JOIN departments d ON d.id = pa.department_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN positions pos ON pos.id = pa.position_id
      WHERE pa.employee_id = $1 AND pa.deleted_at IS NULL
      ORDER BY pa.action_date DESC, pa.created_at DESC
    `;

    const res = await this.pool.query(query, [employeeId]);
    return res.rows;
  }

  /**
   * Проведение кадрового приказа с блокировкой строки сотрудника (FOR UPDATE) внутри транзакции
   */
  async create(dto: CreatePersonnelActionDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Блокируем запись сотрудника для исключения гонки параллельных запросов (race condition)
      const empRes = await client.query(
        `SELECT id, birth_date, deleted_at FROM employees WHERE id = $1 FOR UPDATE`,
        [dto.employee_id],
      );
      if (!empRes.rows[0] || empRes.rows[0].deleted_at) {
        throw new NotFoundException('Сотрудник не найден или удален');
      }

      const employee = empRes.rows[0];

      // Дата кадрового приказа не может быть раньше даты рождения
      if (dto.action_date < employee.birth_date) {
        throw new BadRequestException(
          'Дата кадрового действия не может быть раньше даты рождения сотрудника',
        );
      }

      // Проверка актуального состояния строго внутри транзакции после блокировки
      const currentState = await this.getEmployeeCurrentState(dto.employee_id, client);

      if (dto.action_type === 'hire') {
        if (currentState.status === 'employed') {
          throw new BadRequestException(
            'Сотрудник уже трудоустроен. Для смены подразделения оформите перевод',
          );
        }
      } else {
        if (currentState.status !== 'employed') {
          throw new BadRequestException(
            'Данное действие доступно только для работающего сотрудника',
          );
        }
      }

      // Хронологический порядок дат
      if (
        currentState.last_action_date &&
        dto.action_date < currentState.last_action_date
      ) {
        throw new BadRequestException(
          `Дата кадрового приказа не может быть ранее предыдущего кадрового события (${currentState.last_action_date})`,
        );
      }

      let departmentId = dto.department_id || null;
      let positionId = dto.position_id || null;
      let salary = dto.salary ? Number(dto.salary) : null;

      if (dto.action_type === 'hire' || dto.action_type === 'transfer_dept') {
        const deptCheck = await client.query(
          `SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL`,
          [dto.department_id],
        );
        if (!deptCheck.rows[0]) {
          throw new BadRequestException('Указанный отдел не найден или удален');
        }

        const posCheck = await client.query(
          `SELECT id FROM positions WHERE id = $1 AND deleted_at IS NULL`,
          [dto.position_id],
        );
        if (!posCheck.rows[0]) {
          throw new BadRequestException('Указанная должность не найдена или удалена');
        }

        if (dto.action_type === 'transfer_dept' && !salary) {
          salary = currentState.salary;
        }
      } else if (dto.action_type === 'change_salary') {
        departmentId = currentState.department_id;
        positionId = currentState.position_id;
      } else if (dto.action_type === 'fire') {
        departmentId = null;
        positionId = null;
        salary = null;
      }

      const insertQuery = `
        INSERT INTO personnel_actions (
          employee_id, action_type, department_id, position_id, salary, action_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, employee_id, action_type, department_id, position_id, salary, action_date, created_at
      `;

      const res = await client.query(insertQuery, [
        dto.employee_id,
        dto.action_type,
        departmentId,
        positionId,
        salary,
        dto.action_date,
      ]);

      const created = res.rows[0];

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
   * Мягкое удаление кадрового приказа с проверкой целостности цепочки состояний
   */
  async remove(id: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const targetRes = await client.query(
        `SELECT id, employee_id, action_type, action_date, created_at, deleted_at
         FROM personnel_actions
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );

      if (!targetRes.rows[0]) {
        throw new NotFoundException(`Кадровый приказ с ID ${id} не найден или уже удален`);
      }

      const target = targetRes.rows[0];

      // Блокируем сотрудника на время проверки и удаления приказа
      await client.query(
        `SELECT id FROM employees WHERE id = $1 FOR UPDATE`,
        [target.employee_id],
      );

      // Проверяем, нет ли более поздних активных приказов по этому сотруднику
      const newerRes = await client.query(
        `SELECT id, action_type, action_date
         FROM personnel_actions
         WHERE employee_id = $1
           AND deleted_at IS NULL
           AND id <> $2
           AND (
             action_date > $3
             OR (action_date = $3 AND created_at > $4)
           )
         LIMIT 1`,
        [target.employee_id, id, target.action_date, target.created_at],
      );

      if (newerRes.rows[0]) {
        throw new ConflictException(
          'Невозможно удалить кадровый приказ, так как после него оформлены более поздние приказы. Удаляйте приказы в обратном хронологическом порядке',
        );
      }

      const delRes = await client.query(
        `UPDATE personnel_actions
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, deleted_at`,
        [id],
      );

      await this.auditService.logChange({
        entityType: 'PersonnelAction',
        entityId: id,
        changedFields: {
          deleted_at: { old: null, new: delRes.rows[0].deleted_at },
        },
        client,
      });

      await client.query('COMMIT');
      return { success: true, id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}