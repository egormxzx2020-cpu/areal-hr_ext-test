import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { AuthSecurityService } from './auth-security.service';

export type UserRole = 'admin' | 'hr_manager';

export interface AuthenticatedUser {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  login: string;
  role: UserRole;
}

interface UserAuthRow extends AuthenticatedUser {
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly authSecurityService: AuthSecurityService,
  ) {}

  /**
   * Проверка логина и пароля активного пользователя
   */
  async validateUser(
    login: string,
    plainPassword: string,
  ): Promise<AuthenticatedUser | null> {
    const result = await this.pool.query<UserAuthRow>(
      `
      SELECT id, last_name, first_name, middle_name, login, password_hash, role
      FROM users
      WHERE login = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [login],
    );

    const userRow = result.rows[0];
    if (!userRow) {
      return null;
    }

    const isPasswordValid = await this.authSecurityService.verifyPassword(
      userRow.password_hash,
      plainPassword,
    );

    if (!isPasswordValid) {
      return null;
    }

    const { password_hash: _ignored, ...safeUser } = userRow;
    return safeUser;
  }

  /**
   * Получение профиля активного пользователя по ID для десериализации сессии
   */
  async findById(id: string): Promise<AuthenticatedUser | null> {
    const result = await this.pool.query<AuthenticatedUser>(
      `
      SELECT id, last_name, first_name, middle_name, login, role
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }
}