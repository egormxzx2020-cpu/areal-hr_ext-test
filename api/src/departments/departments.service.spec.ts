import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PG_CONNECTION } from '../database/database.module';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: PG_CONNECTION,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен возвращать список неудаленных отделов', async () => {
      const mockRows = [
        { id: 'dept-1', name: 'Отдел кадров', organization_name: 'ООО Ареал' },
        { id: 'dept-2', name: 'Бухгалтерия', organization_name: 'ООО Ареал' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.findAll();

      expect(result).toEqual(mockRows);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('d.deleted_at IS NULL');
    });

    it('должен фильтровать отделы по organization_id, если параметр передан', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const orgId = '11111111-1111-4111-8111-111111111111';

      await service.findAll(orgId);

      expect(mockPool.query.mock.calls[0][0]).toContain('AND d.organization_id = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual([orgId]);
    });
  });

  describe('findOne', () => {
    it('должен возвращать отдел по корректному id', async () => {
      const mockDept = { id: 'dept-1', name: 'Дирекция' };
      mockPool.query.mockResolvedValueOnce({ rows: [mockDept] });

      const result = await service.findOne('dept-1');

      expect(result).toEqual(mockDept);
    });

    it('должен выбрасывать NotFoundException, если отдел не найден или удален', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'IT-Отдел',
      organization_id: '11111111-1111-4111-8111-111111111111',
      parent_id: null,
    };

    it('должен выбрасывать BadRequestException, если организация не найдена или удалена', async () => {
      // Имитируем, что организация не найдена
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException('Указанная организация не найдена или удалена'),
      );
    });

    it('должен выбрасывать BadRequestException, если родительский отдел принадлежит другой организации', async () => {
      const dtoWithParent = {
        ...dto,
        parent_id: '22222222-2222-4222-8222-222222222222',
      };

      // 1. Организация найдена
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: dto.organization_id }] });
      // 2. Родительский отдел найден, но принадлежит ДРУГОЙ организации
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: dtoWithParent.parent_id, organization_id: 'other-org-id' }],
      });

      await expect(service.create(dtoWithParent)).rejects.toThrow(
        new BadRequestException('Родительский отдел обязан принадлежать той же организации'),
      );
    });

    it('должен успешно создавать отдел при корректных связях', async () => {
      const createdDept = { id: 'new-id', ...dto };
      // 1. Проверка организации
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: dto.organization_id }] });
      // 2. Вставка записи
      mockPool.query.mockResolvedValueOnce({ rows: [createdDept] });

      const result = await service.create(dto);

      expect(result).toEqual(createdDept);
    });
  });

  describe('update (защита от циклов)', () => {
    const deptId = '11111111-1111-4111-8111-111111111111';
    const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('должен выбрасывать BadRequestException при попытке назначить родителем самого себя', async () => {
      // 1. findOne проходит успешно
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId, organization_id: orgId }] });
      // 2. validateOrganization проходит успешно
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] });

      const dto = {
        name: 'Отдел',
        organization_id: orgId,
        parent_id: deptId, // Ссылка на самого себя
      };

      await expect(service.update(deptId, dto)).rejects.toThrow(
        new BadRequestException('Отдел не может быть родительским сам для себя'),
      );
    });

    it('должен блокировать создание циклической зависимости (A -> B -> A) через CTE-поиск', async () => {
      const parentId = '22222222-2222-4222-8222-222222222222';
      // 1. findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId, organization_id: orgId }] });
      // 2. validateOrganization
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: orgId }] });
      // 3. validateParent
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: parentId, organization_id: orgId }] });
      // 4. assertNoCycle: рекурсивный CTE возвращает совпадение (новый родитель уже есть в потомках!)
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: parentId }] });

      const dto = {
        name: 'Отдел A',
        organization_id: orgId,
        parent_id: parentId,
      };

      await expect(service.update(deptId, dto)).rejects.toThrow(
        new BadRequestException(
          'Нельзя назначить родительским подразделение, которое уже является дочерним для данного отдела (обнаружено циклическое замыкание)',
        ),
      );
    });
  });

  describe('remove (409 Conflict и Soft Delete)', () => {
    const deptId = 'dept-to-delete';

    it('должен выбрасывать ConflictException (409), если у отдела есть неудаленные потомки', async () => {
      // 1. findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] });
      // 2. Проверка дочерних подразделений: найден минимум 1 ребенок
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ 1: 1 }] });

      await expect(service.remove(deptId)).rejects.toThrow(ConflictException);
    });

    it('должен выполнять мягкое удаление (UPDATE deleted_at), если дочерних отделов нет', async () => {
      // 1. findOne
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] });
      // 2. Проверка детей: детей нет
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      // 3. Выполнение soft-delete
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: deptId }] });

      const result = await service.remove(deptId);

      expect(result).toEqual({ success: true, id: deptId });
      expect(mockPool.query.mock.calls[2][0]).toContain('UPDATE departments');
      expect(mockPool.query.mock.calls[2][0]).toContain('SET deleted_at = CURRENT_TIMESTAMP');
    });
  });
});