import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';
import { RulesConfigService } from './rules-config.service';

describe('RulesConfigService', () => {
  let service: RulesConfigService;
  let repo: jest.Mocked<Repository<ApprovalRule>>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<ApprovalRule>>> = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesConfigService,
        { provide: getRepositoryToken(ApprovalRule), useValue: repoMock },
      ],
    }).compile();

    service = module.get<RulesConfigService>(RulesConfigService);
    repo = module.get(getRepositoryToken(ApprovalRule));
  });

  describe('findAll()', () => {
    it('devuelve todas las reglas del repositorio', async () => {
      const rules: ApprovalRule[] = [
        {
          id: 1,
          nombre: 'min_coverage',
          descripcion: 'Cobertura mínima',
          activa: true,
          config: {},
          updatedAt: new Date(),
        },
        {
          id: 2,
          nombre: 'require_pr',
          descripcion: 'Requerir PR',
          activa: true,
          config: {},
          updatedAt: new Date(),
        },
      ];
      repo.find.mockResolvedValue(rules);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(result).toBe(rules);
    });

    it('devuelve array vacío si no hay reglas', async () => {
      repo.find.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('update()', () => {
    const baseRule: ApprovalRule = {
      id: 1,
      nombre: 'min_coverage',
      descripcion: 'Cobertura mínima',
      activa: true,
      config: { minCoverage: 80 },
      updatedAt: new Date('2025-01-01'),
    };

    it('lanza NotFoundException si no existe la regla', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { activa: false })).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('actualiza solo activa si solo viene activa', async () => {
      const rule = { ...baseRule, activa: true };
      repo.findOne.mockResolvedValue(rule);
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      const result = await service.update(1, { activa: false });

      expect(result.activa).toBe(false);
      expect(result.config).toEqual({ minCoverage: 80 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, activa: false }),
      );
    });

    it('actualiza solo config si solo viene config', async () => {
      const rule = { ...baseRule };
      repo.findOne.mockResolvedValue(rule);
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      const result = await service.update(1, { config: { minCoverage: 90 } });

      expect(result.config).toEqual({ minCoverage: 90 });
      expect(result.activa).toBe(true);
    });

    it('actualiza ambos campos si vienen los dos', async () => {
      const rule = { ...baseRule };
      repo.findOne.mockResolvedValue(rule);
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      const result = await service.update(1, {
        activa: false,
        config: { minCoverage: 95 },
      });

      expect(result.activa).toBe(false);
      expect(result.config).toEqual({ minCoverage: 95 });
    });

    it('no modifica nada si el patch está vacío (pero persiste la entidad encontrada)', async () => {
      const rule = { ...baseRule };
      repo.findOne.mockResolvedValue(rule);
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      const result = await service.update(1, {});

      expect(result.activa).toBe(true);
      expect(result.config).toEqual({ minCoverage: 80 });
      expect(repo.save).toHaveBeenCalledWith(rule);
    });

    it('trata activa=false como un valor válido (no undefined)', async () => {
      const rule = { ...baseRule, activa: true };
      repo.findOne.mockResolvedValue(rule);
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      const result = await service.update(1, { activa: false });

      expect(result.activa).toBe(false);
    });

    it('busca la regla por id con findOne({ where: { id } })', async () => {
      repo.findOne.mockResolvedValue({ ...baseRule });
      repo.save.mockImplementation(async (r) => r as ApprovalRule);

      await service.update(42, { activa: true });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 42 } });
    });
  });
});
