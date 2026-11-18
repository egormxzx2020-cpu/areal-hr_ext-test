import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const createMockContext = (user?: { id: string; role: string }): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('должен пропускать запрос, если декоратор @Roles не задан', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);
    const context = createMockContext({ id: 'u1', role: 'hr_manager' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('должен пропускать пользователя с разрешенной ролью', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);
    const context = createMockContext({ id: 'u1', role: 'admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('должен выбрасывать ForbiddenException (403), если роль не входит в разрешенные', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);
    const context = createMockContext({ id: 'u2', role: 'hr_manager' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('должен выбрасывать ForbiddenException (403), если пользователь отсутствует в запросе', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin', 'hr_manager']);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});