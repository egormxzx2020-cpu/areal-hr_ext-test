import { AuthService } from './auth.service';
import { AuthSecurityService } from './auth-security.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPool: { query: jest.Mock };
  let mockSecurity: { verifyPassword: jest.Mock };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    mockSecurity = {
      verifyPassword: jest.fn(),
    };
    service = new AuthService(
      mockPool as never,
      mockSecurity as unknown as AuthSecurityService,
    );
  });

  it('должен возвращать профиль без password_hash при верных учетных данных', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-uuid-1',
          last_name: 'Администратор',
          first_name: 'Системный',
          middle_name: null,
          login: 'admin',
          password_hash: '$argon2id$hash',
          role: 'admin',
        },
      ],
    });
    mockSecurity.verifyPassword.mockResolvedValueOnce(true);

    const result = await service.validateUser('admin', 'Admin123!');

    expect(result).toEqual({
      id: 'user-uuid-1',
      last_name: 'Администратор',
      first_name: 'Системный',
      middle_name: null,
      login: 'admin',
      role: 'admin',
    });
    expect(result).not.toHaveProperty('password_hash');
  });

  it('должен возвращать null при неверном пароле', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-uuid-1',
          last_name: 'Администратор',
          first_name: 'Системный',
          middle_name: null,
          login: 'admin',
          password_hash: '$argon2id$hash',
          role: 'admin',
        },
      ],
    });
    mockSecurity.verifyPassword.mockResolvedValueOnce(false);

    await expect(service.validateUser('admin', 'wrong')).resolves.toBeNull();
  });

  it('должен возвращать null, если пользователь не найден или удален', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.validateUser('ghost', 'Admin123!')).resolves.toBeNull();
    expect(mockSecurity.verifyPassword).not.toHaveBeenCalled();
  });

  it('должен возвращать данные пользователя по ID для сессии', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-uuid-1',
          last_name: 'Администратор',
          first_name: 'Системный',
          middle_name: null,
          login: 'admin',
          role: 'admin',
        },
      ],
    });

    const user = await service.findById('user-uuid-1');
    expect(user?.login).toBe('admin');
  });
});