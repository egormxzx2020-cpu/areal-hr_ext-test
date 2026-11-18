import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { AuthSecurityService } from '../auth/auth-security.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import type { UserRole } from '../auth/auth.service';

export interface SafeUserRecord {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  login: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly authSecurityService: AuthSecurityService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Получение списка всех пользователей (активные сверху) без password_hash
   */
  async findAll(): Promise<SafeUserRecord[]> {
    const res = await this.pool.query<SafeUserRecord>(
      `
      SELECT
        id,
        last_name,
        first_name,
        middle_name,
        login,
        role,
        created_at,
        updated_at,
        deleted_at
      FROM users
      ORDER BY (deleted_at IS NOT NULL), created_at DESC
      `,
    );
    return res.rows;
  }

  /**
   * Получение активного пользователя по ID без password_hash
   */
  async findOne(id: string): Promise<SafeUserRecord> {
    const res = await this.pool.query<SafeUserRecord>(
      `
      SELECT
        id,
        last_name,
        first_name,
        middle_name,
        login,
        role,
        created_at,
        updated_at,
        deleted_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id],
    );

    if (!res.rows[0]) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return res.rows[0];
  }

  /**
   * Создание нового пользователя с хешированием пароля по алгоритму Argon2id
   */
  async create(
    dto: CreateUserDto,
    actorUserId?: string | null,
  ): Promise<SafeUserRecord> {
    const passwordHash = await this.authSecurityService.hashPassword(
      dto.password,
    );

    const res = await this.pool.query<SafeUserRecord>(
      `
      INSERT INTO users (
        last_name,
        first_name,
        middle_name,
        login,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        last_name,
        first_name,
        middle_name,
        login,
        role,
        created_at,
        updated_at,
        deleted_at
      `,
      [
        dto.last_name,
        dto.first_name,
        dto.middle_name || null,
        dto.login,
        passwordHash,
        dto.role,
      ],
    );

    const created = res.rows[0];

    await this.auditService.logChange({
      entityType: 'User',
      entityId: created.id,
      changedFields: this.auditService.calculateDiff(null, {
        last_name: created.last_name,
        first_name: created.first_name,
        middle_name: created.middle_name,
        login: created.login,
        role: created.role,
      }),
      userId: actorUserId ?? null,
    });

    return created;
  }

  /**
   * Обновление пользователя с проверкой защиты последнего администратора и опциональной сменой пароля
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    actorUserId?: string | null,
  ): Promise<SafeUserRecord> {
    const current = await this.findOne(id);

    if (current.role === 'admin' && dto.role !== 'admin') {
      if (actorUserId && id === actorUserId) {
        throw new BadRequestException(
          'Нельзя снять права администратора с собственной учетной записи',
        );
      }

      const activeAdminsCount = await this.countActiveAdmins();
      if (activeAdminsCount <= 1) {
        throw new ConflictException(
          'Невозможно изменить роль единственного активного администратора в системе',
        );
      }
    }

    const hasNewPassword =
      typeof dto.password === 'string' && dto.password.trim().length > 0;

    let res;
    if (hasNewPassword) {
      const newPasswordHash = await this.authSecurityService.hashPassword(
        dto.password!,
      );
      res = await this.pool.query<SafeUserRecord>(
        `
        UPDATE users
        SET
          last_name = $1,
          first_name = $2,
          middle_name = $3,
          login = $4,
          password_hash = $5,
          role = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7 AND deleted_at IS NULL
        RETURNING
          id,
          last_name,
          first_name,
          middle_name,
          login,
          role,
          created_at,
          updated_at,
          deleted_at
        `,
        [
          dto.last_name,
          dto.first_name,
          dto.middle_name || null,
          dto.login,
          newPasswordHash,
          dto.role,
          id,
        ],
      );
    } else {
      res = await this.pool.query<SafeUserRecord>(
        `
        UPDATE users
        SET
          last_name = $1,
          first_name = $2,
          middle_name = $3,
          login = $4,
          role = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND deleted_at IS NULL
        RETURNING
          id,
          last_name,
          first_name,
          middle_name,
          login,
          role,
          created_at,
          updated_at,
          deleted_at
        `,
        [
          dto.last_name,
          dto.first_name,
          dto.middle_name || null,
          dto.login,
          dto.role,
          id,
        ],
      );
    }

    if (!res.rows[0]) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    const updated = res.rows[0];

    const diff = this.auditService.calculateDiff(
      {
        last_name: current.last_name,
        first_name: current.first_name,
        middle_name: current.middle_name,
        login: current.login,
        role: current.role,
      },
      {
        last_name: updated.last_name,
        first_name: updated.first_name,
        middle_name: updated.middle_name,
        login: updated.login,
        role: updated.role,
      },
    );

    if (hasNewPassword) {
      diff.password_changed = { old: false, new: true };
    }

    if (Object.keys(diff).length > 0) {
      await this.auditService.logChange({
        entityType: 'User',
        entityId: id,
        changedFields: diff,
        userId: actorUserId ?? null,
      });
    }

    return updated;
  }

  /**
   * Мягкое удаление пользователя с защитой от удаления себя и последнего администратора
   */
  async remove(id: string, actorUserId?: string | null) {
    const current = await this.findOne(id);

    if (actorUserId && id === actorUserId) {
      throw new BadRequestException(
        'Нельзя удалить собственную учетную запись',
      );
    }

    if (current.role === 'admin') {
      const activeAdminsCount = await this.countActiveAdmins();
      if (activeAdminsCount <= 1) {
        throw new ConflictException(
          'Невозможно удалить последнего активного администратора в системе',
        );
      }
    }

    const res = await this.pool.query<{ id: string; deleted_at: string }>(
      `
      UPDATE users
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, deleted_at
      `,
      [id],
    );

    if (!res.rows[0]) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    await this.auditService.logChange({
      entityType: 'User',
      entityId: id,
      changedFields: {
        deleted_at: { old: current.deleted_at, new: res.rows[0].deleted_at },
      },
      userId: actorUserId ?? null,
    });

    return { success: true, id: res.rows[0].id };
  }

  private async countActiveAdmins(): Promise<number> {
    const res = await this.pool.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin' AND deleted_at IS NULL`,
    );
    return res.rows[0]?.cnt ?? 0;
  }
}