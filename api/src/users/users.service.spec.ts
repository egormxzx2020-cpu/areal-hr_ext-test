import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthSecurityService } from '../auth/auth-security.service';
import { AuditService } from '../audit/audit.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockPool: { query: jest.Mock };
  let mockSecurity: { hashPassword: jest.Mock };
  let mockAudit: { logChange: jest.Mock; calculateDiff: jest.Mock };

  const adminUser = {
    id: 'admin-1',
    last_name: 'Администратор',
    first_name: 'Системный',
    middle_name: null,
    login: 'admin',
    role: 'admin' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    mockSecurity = {
      hashPassword: jest.fn().mockResolvedValue('$argon2id$hashed'),
    };
    mockAudit = {
      logChange: jest.fn().mockResolvedValue(undefined),
      calculateDiff: jest.fn().mockReturnValue({ login: { old: null, new: 'hr1' } }),
    };

    service = new UsersService(
      mockPool as never,
      mockSecurity as unknown as AuthSecurityService,
      mockAudit as unknown as AuditService,
    );
  });

  it('должен создавать пользователя с хешем Argon2id и не передавать пароль в аудит', async () => {
    const createdRow = {
      id: 'hr-1',
      last_name: 'Иванова',
      first_name: 'Анна',
      middle_name: 'Сергеевна',
      login: 'hr_anna',
      role: 'hr_manager' as const,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      deleted_at: null,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [createdRow] });

    const result = await service.create(
      {
        last_name: 'Иванова',
        first_name: 'Анна',
        middle_name: 'Сергеевна',
        login: 'hr_anna',
        password: 'Password123!',
        role: 'hr_manager',
      },
      'admin-1',
    );

    expect(mockSecurity.hashPassword).toHaveBeenCalledWith('Password123!');
    expect(result).toEqual(createdRow);
    expect(result).not.toHaveProperty('password_hash');
    expect(mockAudit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'User',
        entityId: 'hr-1',
        userId: 'admin-1',
      }),
    );
  });

  it('должен запрещать администратору удалять собственную учетную запись', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] });

    await expect(service.remove('admin-1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('должен запрещать удаление последнего активного администратора в системе', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ cnt: 1 }] });

    await expect(service.remove('admin-1', 'other-admin')).rejects.toThrow(
      ConflictException,
    );
  });

  it('должен запрещать снятие роли admin с последнего активного администратора', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ cnt: 1 }] });

    await expect(
      service.update(
        'admin-1',
        {
          last_name: 'Администратор',
          first_name: 'Системный',
          middle_name: null,
          login: 'admin',
          role: 'hr_manager',
        },
        'other-admin',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('должен выполнять мягкое удаление менеджера по персоналу', async () => {
    const hrUser = {
      ...adminUser,
      id: 'hr-2',
      login: 'hr_petrov',
      role: 'hr_manager' as const,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [hrUser] });
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'hr-2', deleted_at: '2026-05-01T12:00:00Z' }],
    });

    const result = await service.remove('hr-2', 'admin-1');

    expect(result).toEqual({ success: true, id: 'hr-2' });
    expect(mockAudit.logChange).toHaveBeenCalledTimes(1);
  });

  it('должен выбрасывать NotFoundException, если пользователь не найден', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.findOne('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});