import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';
import { Release } from '../entities/release.entity';
import { ReleaseManager } from './release.manager';

type MockHttpService = { get: jest.Mock; post: jest.Mock };
type MockRepo<T> = { find: jest.Mock; [k: string]: jest.Mock };

const axiosRes = <T>(status: number, data: T): AxiosResponse<T> =>
  ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: {} as never },
  }) as AxiosResponse<T>;

const buildRelease = (overrides: Partial<Release> = {}): Release => ({
  id: 'rel-1',
  fecha: new Date('2025-01-15T10:00:00Z'),
  equipo: 'payments',
  tipo: 'rs',
  descripcion: 'Cambios en checkout',
  prIdentifier: 'JIRA-123',
  cobertura: 85,
  stack: [{ framework: 'angular', version: '17.0.0' }],
  estado: 'pending',
  aprobacionAutomatica: false,
  motivoRechazo: undefined as unknown as string,
  approverEmail: 'approver@test.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ReleaseManager - process()', () => {
  let manager: ReleaseManager;
  let httpService: MockHttpService;
  let rulesRepo: MockRepo<ApprovalRule>;
  const originalRulesUrl = process.env.RULES_SERVICE_URL;

  beforeEach(async () => {
    const mockHttp: MockHttpService = { get: jest.fn(), post: jest.fn() };
    const mockRulesRepo: MockRepo<ApprovalRule> = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleaseManager,
        { provide: HttpService, useValue: mockHttp },
        { provide: getRepositoryToken(ApprovalRule), useValue: mockRulesRepo },
      ],
    }).compile();

    manager = module.get<ReleaseManager>(ReleaseManager);
    httpService = module.get<HttpService>(HttpService) as unknown as MockHttpService;
    rulesRepo = module.get(getRepositoryToken(ApprovalRule)) as MockRepo<ApprovalRule>;

    process.env.RULES_SERVICE_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    if (originalRulesUrl === undefined) {
      delete process.env.RULES_SERVICE_URL;
    } else {
      process.env.RULES_SERVICE_URL = originalRulesUrl;
    }
    jest.clearAllMocks();
  });

  it('tipo fx → retorna approved=true sin llamar a rules-service', async () => {
    const result = await manager.process(buildRelease({ tipo: 'fx' }));

    expect(result.estado).toBe('approved');
    expect(httpService.post).not.toHaveBeenCalled();
    expect(rulesRepo.find).not.toHaveBeenCalled();
  });

  it('tipo cv → retorna approved=true sin llamar a rules-service', async () => {
    const result = await manager.process(buildRelease({ tipo: 'cv' }));

    expect(result.estado).toBe('approved');
    expect(httpService.post).not.toHaveBeenCalled();
    expect(rulesRepo.find).not.toHaveBeenCalled();
  });

  it('tipo fx → aprobacionAutomatica=false', async () => {
    const result = await manager.process(buildRelease({ tipo: 'fx' }));

    expect(result.aprobacionAutomatica).toBe(false);
  });

  it('tipo rs + rules PASS → retorna estado=approved, aprobacionAutomatica=true', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(
      of(axiosRes(200, { passed: true, conditions: {} })),
    );

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.estado).toBe('approved');
    expect(result.aprobacionAutomatica).toBe(true);
  });

  it('tipo rs + rules FAIL → retorna estado=pending, aprobacionAutomatica=false', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(
      of(axiosRes(200, { passed: false, motivoRechazo: 'Cobertura insuficiente' })),
    );

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.estado).toBe('pending');
    expect(result.aprobacionAutomatica).toBe(false);
  });

  it('tipo rs + rules FAIL → retorna motivoRechazo del rules-service', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(
      of(
        axiosRes(200, {
          passed: false,
          motivoRechazo: 'Cobertura insuficiente: 50% (mínimo 80%)',
        }),
      ),
    );

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.motivoRechazo).toBe('Cobertura insuficiente: 50% (mínimo 80%)');
  });

  it('tipo rs → llama a rules-service con las reglas activas de la DB', async () => {
    const activeRules: Partial<ApprovalRule>[] = [
      { id: 1, nombre: 'min_coverage', activa: true, config: { minCoverage: 80 } },
      { id: 2, nombre: 'require_pr', activa: true, config: {} },
    ];
    rulesRepo.find.mockResolvedValue(activeRules);
    httpService.post.mockReturnValue(
      of(axiosRes(200, { passed: true })),
    );

    const release = buildRelease({
      tipo: 'rs',
      cobertura: 90,
      descripcion: 'desc',
      prIdentifier: 'JIRA-1',
      stack: [{ framework: 'angular', version: '17.0.0' }],
    });

    await manager.process(release);

    expect(httpService.post).toHaveBeenCalledTimes(1);
    const [url, body] = httpService.post.mock.calls[0];
    expect(url).toBe('http://localhost:3001/rules/evaluate');
    expect(body).toEqual({
      cobertura: 90,
      descripcion: 'desc',
      prIdentifier: 'JIRA-1',
      stack: [{ framework: 'angular', version: '17.0.0' }],
      rules: activeRules,
    });
  });

  it('tipo rs → solo pasa reglas activas (activa=true) al rules-service', async () => {
    const activeRules: Partial<ApprovalRule>[] = [
      { id: 1, nombre: 'min_coverage', activa: true, config: { minCoverage: 80 } },
    ];
    rulesRepo.find.mockResolvedValue(activeRules);
    httpService.post.mockReturnValue(of(axiosRes(200, { passed: true })));

    await manager.process(buildRelease({ tipo: 'rs' }));

    expect(rulesRepo.find).toHaveBeenCalledWith({ where: { activa: true } });
    const [, body] = httpService.post.mock.calls[0];
    expect(body.rules).toEqual(activeRules);
    expect(body.rules.every((r: ApprovalRule) => r.activa === true)).toBe(true);
  });

  it('rules-service no responde → retorna pending con motivoRechazo', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(
      throwError(() => new Error('connection refused')),
    );

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.estado).toBe('pending');
    expect(result.aprobacionAutomatica).toBe(false);
    expect(result.motivoRechazo).toMatch(/rules-service|connection/i);
  });

  it('rules-service responde con status >= 300 → retorna pending', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(of(axiosRes(500, { error: 'boom' })));

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.estado).toBe('pending');
    expect(result.aprobacionAutomatica).toBe(false);
    expect(result.motivoRechazo).toContain('500');
  });

  it('RULES_SERVICE_URL no configurado → retorna pending sin llamar al servicio', async () => {
    delete process.env.RULES_SERVICE_URL;
    rulesRepo.find.mockResolvedValue([]);

    const result = await manager.process(buildRelease({ tipo: 'rs' }));

    expect(result.estado).toBe('pending');
    expect(result.motivoRechazo).toContain('RULES_SERVICE_URL');
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('RULES_SERVICE_URL con barra final → la elimina al construir la URL', async () => {
    process.env.RULES_SERVICE_URL = 'http://localhost:3001/';
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(of(axiosRes(200, { passed: true })));

    await manager.process(buildRelease({ tipo: 'rs' }));

    expect(httpService.post).toHaveBeenCalledWith(
      'http://localhost:3001/rules/evaluate',
      expect.any(Object),
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it('usa validateStatus: () => true para recibir también respuestas no-2xx', async () => {
    rulesRepo.find.mockResolvedValue([]);
    httpService.post.mockReturnValue(of(axiosRes(200, { passed: true })));

    await manager.process(buildRelease({ tipo: 'rs' }));

    const [, , options] = httpService.post.mock.calls[0];
    expect(options.validateStatus(500)).toBe(true);
    expect(options.validateStatus(200)).toBe(true);
  });

  describe('formatRulesCallError — branches de error', () => {
    it('error axios con status 500 → motivoRechazo contiene "HTTP 500"', async () => {
      rulesRepo.find.mockResolvedValue([]);
      const axiosErr = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 500 },
      }) as AxiosError;
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      httpService.post.mockReturnValue(throwError(() => axiosErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.estado).toBe('pending');
      expect(result.motivoRechazo).toContain('HTTP 500');

      (axios.isAxiosError as unknown as jest.Mock).mockRestore?.();
    });

    it('error axios con ECONNREFUSED → motivoRechazo menciona el código y rules-service', async () => {
      rulesRepo.find.mockResolvedValue([]);
      const axiosErr = Object.assign(new Error('connect ECONNREFUSED'), {
        isAxiosError: true,
        code: 'ECONNREFUSED',
        response: undefined,
      }) as AxiosError;
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      httpService.post.mockReturnValue(throwError(() => axiosErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('ECONNREFUSED');
      expect(result.motivoRechazo).toMatch(/rules-service|RULES_SERVICE_URL/);

      (axios.isAxiosError as unknown as jest.Mock).mockRestore?.();
    });

    it('error axios con ENOTFOUND → motivoRechazo menciona el código', async () => {
      rulesRepo.find.mockResolvedValue([]);
      const axiosErr = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
        isAxiosError: true,
        code: 'ENOTFOUND',
        response: undefined,
      }) as AxiosError;
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      httpService.post.mockReturnValue(throwError(() => axiosErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('ENOTFOUND');

      (axios.isAxiosError as unknown as jest.Mock).mockRestore?.();
    });

    it('error axios sin status y sin código → usa err.message', async () => {
      rulesRepo.find.mockResolvedValue([]);
      const axiosErr = Object.assign(new Error('timeout'), {
        isAxiosError: true,
        response: undefined,
      }) as AxiosError;
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      httpService.post.mockReturnValue(throwError(() => axiosErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('timeout');

      (axios.isAxiosError as unknown as jest.Mock).mockRestore?.();
    });

    it('AggregateError (IPv4+IPv6 ECONNREFUSED) → concatena los mensajes', async () => {
      rulesRepo.find.mockResolvedValue([]);
      if (typeof AggregateError === 'undefined') {
        return;
      }
      const aggErr = new AggregateError(
        [new Error('connect ECONNREFUSED ::1:3001'), new Error('connect ECONNREFUSED 127.0.0.1:3001')],
        'AggregateError',
      );
      httpService.post.mockReturnValue(throwError(() => aggErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('::1:3001');
      expect(result.motivoRechazo).toContain('127.0.0.1:3001');
      expect(result.motivoRechazo).toContain(';');
    });

    it('AggregateError con valores no-Error → los serializa con String()', async () => {
      rulesRepo.find.mockResolvedValue([]);
      if (typeof AggregateError === 'undefined') {
        return;
      }
      const aggErr = new AggregateError(
        ['boom-1', 'boom-2'],
        'AggregateError',
      );
      httpService.post.mockReturnValue(throwError(() => aggErr));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('boom-1');
      expect(result.motivoRechazo).toContain('boom-2');
    });

    it('valor lanzado que no es Error (string) → usa String(err)', async () => {
      rulesRepo.find.mockResolvedValue([]);
      httpService.post.mockReturnValue(throwError(() => 'boom-raw'));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('boom-raw');
    });

    it('valor lanzado no-Error (number) → lo serializa a string', async () => {
      rulesRepo.find.mockResolvedValue([]);
      httpService.post.mockReturnValue(throwError(() => 42));

      const result = await manager.process(buildRelease({ tipo: 'rs' }));

      expect(result.motivoRechazo).toContain('42');
    });
  });
});
