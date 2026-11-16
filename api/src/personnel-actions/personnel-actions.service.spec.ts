import { Test, TestingModule } from '@nestjs/testing';
import { PersonnelActionsService } from './personnel-actions.service';
import { PG_CONNECTION } from '../database/database.constants';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { createPersonnelActionSchema } from './personnel-actions.dto';

describe('PersonnelActionsService', () => {
  let service: PersonnelActionsService;
  let mockClient: { query: jest.Mock; release: jest.Mock };
  let mockPool: { query: jest.Mock; connect: jest.Mock };
  let mockAuditService: { logChange: jest.Mock; calculateDiff: jest.Mock };

  beforeEach(async () => {
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    mockAuditService = {
      logChange: jest.fn().mockResolvedValue(undefined),
      calculateDiff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonnelActionsService,
        { provide: PG_CONNECTION, useValue: mockPool },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PersonnelActionsService>(PersonnelActionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create (транзакция и блокировка FOR UPDATE)', () => {
    it('должен блокировать строку сотрудника через FOR UPDATE внутри транзакции при проведении приказа', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      }); // SELECT ... FOR UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // getEmployeeCurrentState -> not_hired
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'dept-1' }] }); // deptCheck
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'pos-1' }] }); // posCheck
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pa-1',
            employee_id: 'emp-1',
            action_type: 'hire',
            department_id: 'dept-1',
            position_id: 'pos-1',
            salary: 100000,
            action_date: '2026-02-01',
          },
        ],
      }); // INSERT INTO personnel_actions
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const res = await service.create({
        employee_id: 'emp-1',
        action_type: 'hire',
        department_id: 'dept-1',
        position_id: 'pos-1',
        salary: 100000,
        action_date: '2026-02-01',
      });

      expect(res.id).toBe('pa-1');
      expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');
      expect(mockClient.query.mock.calls[1][0]).toContain('FOR UPDATE');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('должен выбрасывать BadRequestException, если дата события раньше даты рождения', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      }); // FOR UPDATE
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        service.create({
          employee_id: 'emp-1',
          action_type: 'hire',
          department_id: 'dept-1',
          position_id: 'pos-1',
          salary: 100000,
          action_date: '1990-01-01',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Дата кадрового действия не может быть раньше даты рождения сотрудника',
        ),
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('должен запрещать увольнение неработающего сотрудника', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      }); // FOR UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // getEmployeeCurrentState -> not_hired
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        service.create({
          employee_id: 'emp-1',
          action_type: 'fire',
          action_date: '2026-03-01',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Данное действие доступно только для работающего сотрудника',
        ),
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('должен запрещать повторный прием уже работающего сотрудника и откатывать транзакцию', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      }); // FOR UPDATE
      mockClient.query.mockResolvedValueOnce({
        rows: [{ action_type: 'hire', action_date: '2026-01-01' }],
      }); // getEmployeeCurrentState -> employed
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        service.create({
          employee_id: 'emp-1',
          action_type: 'hire',
          department_id: 'dept-1',
          position_id: 'pos-1',
          salary: 90000,
          action_date: '2026-04-01',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Сотрудник уже трудоустроен. Для смены подразделения оформите перевод',
        ),
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('remove (проверка целостности цепочки приказов)', () => {
    it('должен выбрасывать ConflictException (409), если после удаляемого приказа есть более поздние приказы', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pa-hire',
            employee_id: 'emp-1',
            action_type: 'hire',
            action_date: '2026-01-10',
            created_at: '2026-01-10T09:00:00Z',
            deleted_at: null,
          },
        ],
      }); // SELECT target action
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }] }); // FOR UPDATE employee
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pa-transfer',
            action_type: 'transfer_dept',
            action_date: '2026-02-15',
          },
        ],
      }); // SELECT newer actions
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove('pa-hire')).rejects.toThrow(ConflictException);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockAuditService.logChange).not.toHaveBeenCalled();
    });

    it('должен мягко удалять последний приказ в цепочке', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pa-last',
            employee_id: 'emp-1',
            action_type: 'change_salary',
            action_date: '2026-03-01',
            created_at: '2026-03-01T09:00:00Z',
            deleted_at: null,
          },
        ],
      }); // SELECT target
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }] }); // FOR UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT newer -> пусто
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'pa-last', deleted_at: '2026-03-05T10:00:00Z' }],
      }); // UPDATE deleted_at
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const result = await service.remove('pa-last');

      expect(result).toEqual({ success: true, id: 'pa-last' });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(1);
    });

    it('должен выбрасывать NotFoundException, если приказ не найден', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT target
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPersonnelActionSchema (Joi)', () => {
    const validBase = {
      employee_id: '11111111-1111-4111-8111-111111111111',
      action_type: 'hire',
      department_id: '22222222-2222-4222-8222-222222222222',
      position_id: '33333333-3333-4333-8333-333333333333',
      salary: 120000,
      action_date: '2026-03-01',
    };

    it('должен отклонять дату кадрового приказа в будущем (2099-01-01)', () => {
      const { error } = createPersonnelActionSchema.validate({
        ...validBase,
        action_date: '2099-01-01',
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain(
        'Дата кадрового приказа не может быть в будущем',
      );
    });

    it('должен отклонять оклад, превышающий предел numeric(12,2)', () => {
      const { error } = createPersonnelActionSchema.validate({
        ...validBase,
        salary: 10000000000,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain(
        'Оклад не может превышать 9 999 999 999.99',
      );
    });
  });
});