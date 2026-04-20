import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { CreateReleaseDto } from '../dto/create-release.dto';
import { Release } from '../entities/release.entity';
import { ReleaseManager } from './release.manager';
import { ReleaseService } from './release.service';

type MockHttpService = { get: jest.Mock; post: jest.Mock };
type MockReleaseRepo = {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
};
type MockReleaseManager = { process: jest.Mock };

const axiosRes = <T>(status: number, data: T): AxiosResponse<T> =>
  ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: {} as never },
  }) as AxiosResponse<T>;

const baseDto: CreateReleaseDto = {
  fecha: '2025-01-15T10:00:00Z',
  equipo: 'payments',
  tipo: 'rs',
  descripcion: 'Cambios en checkout',
  prIdentifier: 'JIRA-123',
  cobertura: 85,
  stack: [{ framework: 'angular', version: '17.0.0' }],
  approverEmail: 'approver@test.com',
};

describe('ReleaseService', () => {
  let service: ReleaseService;
  let releaseRepo: MockReleaseRepo;
  let releaseManager: MockReleaseManager;
  let httpService: MockHttpService;
  const originalNotifUrl = process.env.NOTIFICATION_SERVICE_URL;

  beforeEach(async () => {
    const mockRepo: MockReleaseRepo = {
      create: jest.fn((entity) => ({ ...entity })),
      save: jest.fn(async (entity) => ({ id: 'rel-1', ...entity })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const mockManager: MockReleaseManager = { process: jest.fn() };
    const mockHttp: MockHttpService = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleaseService,
        { provide: getRepositoryToken(Release), useValue: mockRepo },
        { provide: ReleaseManager, useValue: mockManager },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    service = module.get<ReleaseService>(ReleaseService);
    releaseRepo = module.get(getRepositoryToken(Release)) as MockReleaseRepo;
    releaseManager = module.get(ReleaseManager) as unknown as MockReleaseManager;
    httpService = module.get(HttpService) as unknown as MockHttpService;

    process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3002';
  });

  afterEach(() => {
    if (originalNotifUrl === undefined) {
      delete process.env.NOTIFICATION_SERVICE_URL;
    } else {
      process.env.NOTIFICATION_SERVICE_URL = originalNotifUrl;
    }
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('guarda el release inicialmente con estado pending', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'approved',
        aprobacionAutomatica: true,
      });

      await service.create(baseDto);

      expect(releaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'pending' }),
      );
      expect(releaseRepo.save).toHaveBeenCalled();
      const firstSaveArg = releaseRepo.save.mock.calls[0][0];
      expect(firstSaveArg.estado).toBe('pending');
    });

    it('tipo rs + manager approved → actualiza estado=approved, aprobacionAutomatica=true', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'approved',
        aprobacionAutomatica: true,
      });

      const result = await service.create({ ...baseDto, tipo: 'rs' });

      expect(result.estado).toBe('approved');
      expect(result.aprobacionAutomatica).toBe(true);
    });

    it('tipo rs + manager pending → actualiza estado=pending, aprobacionAutomatica=false', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: 'Cobertura insuficiente',
      });
      httpService.post.mockReturnValue(of(axiosRes(200, { ok: true })));

      const result = await service.create({ ...baseDto, tipo: 'rs' });

      expect(result.estado).toBe('pending');
      expect(result.aprobacionAutomatica).toBe(false);
    });

    it('tipo rs + manager pending → llama a notification-service', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: 'Cobertura insuficiente',
      });
      httpService.post.mockReturnValue(of(axiosRes(200, { ok: true })));

      await service.create({ ...baseDto, tipo: 'rs' });

      expect(httpService.post).toHaveBeenCalledTimes(1);
      const [url, payload] = httpService.post.mock.calls[0];
      expect(url).toBe('http://localhost:3002/notifications/email');
      expect(payload).toEqual(
        expect.objectContaining({
          approverEmail: baseDto.approverEmail,
          equipo: baseDto.equipo,
          tipo: 'rs',
          descripcion: baseDto.descripcion,
          prIdentifier: baseDto.prIdentifier,
          motivoRechazo: 'Cobertura insuficiente',
          releaseId: 'rel-1',
        }),
      );
    });

    it('tipo rs + manager pending → guarda motivoRechazo en el release', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: 'Framework obsoleto',
      });
      httpService.post.mockReturnValue(of(axiosRes(200, { ok: true })));

      const result = await service.create({ ...baseDto, tipo: 'rs' });

      expect(result.motivoRechazo).toBe('Framework obsoleto');
      const lastSaveArg =
        releaseRepo.save.mock.calls[releaseRepo.save.mock.calls.length - 1][0];
      expect(lastSaveArg.motivoRechazo).toBe('Framework obsoleto');
    });

    it('tipo rs + manager approved → NO llama a notification-service', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'approved',
        aprobacionAutomatica: true,
      });

      await service.create({ ...baseDto, tipo: 'rs' });

      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('tipo fx → approved, aprobacionAutomatica=false, sin notificación', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'approved',
        aprobacionAutomatica: false,
      });

      const result = await service.create({ ...baseDto, tipo: 'fx' });

      expect(result.estado).toBe('approved');
      expect(result.aprobacionAutomatica).toBe(false);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('tipo cv → approved, aprobacionAutomatica=false, sin notificación', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'approved',
        aprobacionAutomatica: false,
      });

      const result = await service.create({ ...baseDto, tipo: 'cv' });

      expect(result.estado).toBe('approved');
      expect(result.aprobacionAutomatica).toBe(false);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('retorna el release con todos los campos actualizados', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: 'falta algo',
      });
      httpService.post.mockReturnValue(of(axiosRes(200, { ok: true })));

      const result = await service.create(baseDto);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'rel-1',
          equipo: baseDto.equipo,
          tipo: baseDto.tipo,
          descripcion: baseDto.descripcion,
          prIdentifier: baseDto.prIdentifier,
          cobertura: baseDto.cobertura,
          stack: baseDto.stack,
          approverEmail: baseDto.approverEmail,
          estado: 'pending',
          aprobacionAutomatica: false,
          motivoRechazo: 'falta algo',
        }),
      );
    });

    it('falla de notification-service no propaga error (se registra y sigue)', async () => {
      releaseManager.process.mockResolvedValue({
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: 'algo',
      });
      httpService.post.mockImplementation(() => {
        throw new Error('notification down');
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.create(baseDto)).resolves.toBeDefined();
      errSpy.mockRestore();
    });
  });

  describe('findAll()', () => {
    it('retorna todos los releases del repositorio', async () => {
      const releases = [
        { id: 'r1', equipo: 'a' } as unknown as Release,
        { id: 'r2', equipo: 'b' } as unknown as Release,
      ];
      releaseRepo.find.mockResolvedValue(releases);

      const result = await service.findAll();

      expect(result).toEqual(releases);
      expect(releaseRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('retorna array vacío si no hay releases', async () => {
      releaseRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne()', () => {
    it('retorna el release por id', async () => {
      const release = { id: 'rel-1', equipo: 'payments' } as unknown as Release;
      releaseRepo.findOne.mockResolvedValue(release);

      const result = await service.findOne('rel-1');

      expect(result).toEqual(release);
      expect(releaseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'rel-1' },
      });
    });

    it('lanza NotFoundException si el id no existe', async () => {
      releaseRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveManually()', () => {
    it('cambia estado a approved', async () => {
      const release = {
        id: 'rel-1',
        estado: 'pending',
        aprobacionAutomatica: true,
      } as unknown as Release;
      releaseRepo.findOne.mockResolvedValue(release);
      releaseRepo.save.mockImplementation(async (r) => r);

      const result = await service.approveManually('rel-1');

      expect(result.estado).toBe('approved');
    });

    it('cambia aprobacionAutomatica a false', async () => {
      const release = {
        id: 'rel-1',
        estado: 'pending',
        aprobacionAutomatica: true,
      } as unknown as Release;
      releaseRepo.findOne.mockResolvedValue(release);
      releaseRepo.save.mockImplementation(async (r) => r);

      const result = await service.approveManually('rel-1');

      expect(result.aprobacionAutomatica).toBe(false);
    });

    it('lanza NotFoundException si el id no existe', async () => {
      releaseRepo.findOne.mockResolvedValue(null);

      await expect(service.approveManually('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
