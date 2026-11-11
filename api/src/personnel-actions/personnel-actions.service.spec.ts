import { Test, TestingModule } from '@nestjs/testing';
import { PersonnelActionsService } from './personnel-actions.service';
import { PG_CONNECTION } from '../database/database.constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('PersonnelActionsService', () => {
  let service: PersonnelActionsService;
  let mockClient: { query: jest.Mock; release: jest.Mock };
  let mockPool: { query: jest.Mock; connect: jest.Mock };
  let mockAuditService: { logChange: jest.Mock; calculateDiff: jest.Mock };

  beforeEach(async () => {
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { query: jest.fn(), connect: jest.fn().mockResolvedValue(mockClient) };
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

  describe('getEmployeeCurrentState', () => {
    it('должен возвращать статус not_hired, если приказов не было', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const state = await service.getEmployeeCurrentState('emp-1');
      expect(state.status).toBe('not_hired');
      expect(state.salary).toBeNull();
    });

    it('должен возвращать статус fired, если последний приказ - fire', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ action_type: 'fire', action_date: '2026-05-01' }],
      });

      const state = await service.getEmployeeCurrentState('emp-1');
      expect(state.status).toBe('fired');
      expect(state.department_name).toBeNull();
    });

    it('должен возвращать employed и реквизиты при активном найме', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            action_type: 'hire',
            department_id: 'dept-1',
            department_name: 'IT',
            position_id: 'pos-1',
            position_name: 'Dev',
            salary: '120000.00',
            action_date: '2026-01-15',
          },
        ],
      });

      const state = await service.getEmployeeCurrentState('emp-1');
      expect(state.status).toBe('employed');
      expect(state.salary).toBe(120000);
      expect(state.position_name).toBe('Dev');
    });
  });

  describe('create (машина состояний)', () => {
    it('должен выбрасывать BadRequestException, если дата события раньше даты рождения', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      });

      await expect(
        service.create({
          employee_id: 'emp-1',
          action_type: 'hire',
          department_id: 'dept-1',
          position_id: 'pos-1',
          salary: 80000,
          action_date: '1990-01-01',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Дата кадрового действия не может быть раньше даты рождения сотрудника',
        ),
      );
    });

    it('должен запрещать увольнение неработающего сотрудника', async () => {
      // 1. Поиск сотрудника
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      });
      // 2. getEmployeeCurrentState -> not_hired
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.create({
          employee_id: 'emp-1',
          action_type: 'fire',
          action_date: '2026-03-01',
        }),
      ).rejects.toThrow(
        new BadRequestException('Данное действие доступно только для работающего сотрудника'),
      );
    });

    it('должен запрещать повторный прием уже работающего сотрудника', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ action_type: 'hire', action_date: '2026-01-01' }],
      });

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
    });

    it('должен успешно проводить прием на работу в транзакции', async () => {
      // 1. Поиск сотрудника
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-1', birth_date: '1995-10-20', deleted_at: null }],
      });
      // 2. getEmployeeCurrentState (not_hired)
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // 3. deptCheck
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'dept-1' }] });
      // 4. posCheck
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'pos-1' }] });

      // Транзакция
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
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
      }); // INSERT
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
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(1);
    });
  });
});