import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class AuthSecurityService {
  /**
   * Хеширование пароля по алгоритму Argon2id
   */
  async hashPassword(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
    });
  }

  /**
   * Проверка соответствия открытого пароля сохраненному хешу Argon2id
   */
  async verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      return false;
    }
  }
}