import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';

export interface ChangedFieldDiff {
  old: any;
  new: any;
}

export type ChangedFieldsMap = Record<string, ChangedFieldDiff>;

export interface LogChangeParams {
  entityType: string;
  entityId: string;
  changedFields: ChangedFieldsMap;
  userId?: string | null;
  client?: PoolClient;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  /**
   * Запись события аудита в таблицу audit_logs.
   * Если передан клиент транзакции client, запись выполняется внутри неё атомарно.
   */
  async logChange(params: LogChangeParams): Promise<void> {
    const { entityType, entityId, changedFields, userId = null, client } = params;

    if (!changedFields || Object.keys(changedFields).length === 0) {
      return;
    }

    const runner = client || this.pool;
    const query = `
      INSERT INTO audit_logs (entity_type, entity_id, changed_fields, user_id)
      VALUES ($1, $2, $3, $4)
    `;

    try {
      await runner.query(query, [
        entityType,
        entityId,
        JSON.stringify(changedFields),
        userId,
      ]);
    } catch (err: any) {
      this.logger.error(
        `Ошибка записи аудита для ${entityType} [${entityId}]: ${err?.message || err}`,
      );
      throw err;
    }
  }

  /**
   * Вычисление дельты изменений между старым и новым состоянием объекта.
   */
  calculateDiff(
    oldObj: Record<string, any> | null,
    newObj: Record<string, any> | null,
    ignoreFields: string[] = ['created_at', 'updated_at', 'files_count', 'passport_files'],
  ): ChangedFieldsMap {
    const diff: ChangedFieldsMap = {};
    const ignoreSet = new Set(ignoreFields);

    if (!oldObj && newObj) {
      for (const [key, val] of Object.entries(newObj)) {
        if (!ignoreSet.has(key) && val !== undefined) {
          diff[key] = { old: null, new: val };
        }
      }
      return diff;
    }

    if (oldObj && newObj) {
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        if (ignoreSet.has(key)) continue;

        const oldVal = oldObj[key] !== undefined ? oldObj[key] : null;
        const newVal = newObj[key] !== undefined ? newObj[key] : null;

        const normalizedOld = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
        const normalizedNew = newVal instanceof Date ? newVal.toISOString() : newVal;

        if (JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew)) {
          diff[key] = { old: oldVal, new: newVal };
        }
      }
    }

    return diff;
  }

  /**
   * Получение истории изменений конкретной сущности
   */
  async findByEntity(entityType: string, entityId: string) {
    const query = `
      SELECT 
        al.id,
        al.changed_at,
        al.user_id,
        u.login AS user_login,
        TRIM(CONCAT_WS(' ', u.last_name, u.first_name, u.middle_name)) AS user_full_name,
        al.entity_type,
        al.entity_id,
        al.changed_fields
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.entity_type = $1 AND al.entity_id = $2
      ORDER BY al.changed_at DESC
    `;
    const res = await this.pool.query(query, [entityType, entityId]);
    return res.rows;
  }

  /**
   * Получение общего журнала аудита с пагинацией
   */
  async findAll(limit = 50, offset = 0, entityType?: string) {
    let query = `
      SELECT 
        al.id,
        al.changed_at,
        al.user_id,
        u.login AS user_login,
        TRIM(CONCAT_WS(' ', u.last_name, u.first_name, u.middle_name)) AS user_full_name,
        al.entity_type,
        al.entity_id,
        al.changed_fields
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      query += ` AND al.entity_type = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY al.changed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }
}