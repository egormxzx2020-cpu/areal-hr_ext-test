import { AuthSecurityService } from './auth-security.service';

describe('AuthSecurityService', () => {
  let service: AuthSecurityService;

  beforeEach(() => {
    service = new AuthSecurityService();
  });

  it('должен генерировать хеш в формате Argon2id', async () => {
    const hash = await service.hashPassword('SecretPass123!');

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('должен подтверждать верный пароль и отклонять неверный', async () => {
    const hash = await service.hashPassword('SecretPass123!');

    await expect(service.verifyPassword(hash, 'SecretPass123!')).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'WrongPass!')).resolves.toBe(false);
  });

  it('должен безопасно возвращать false при поврежденном хеше', async () => {
    await expect(service.verifyPassword('invalid-hash-format', 'SecretPass123!')).resolves.toBe(
      false,
    );
  });
});