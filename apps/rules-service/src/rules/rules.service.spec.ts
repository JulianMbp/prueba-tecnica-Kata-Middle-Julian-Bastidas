import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { EvaluateRulesDto } from '../dto/evaluate-rules.dto';
import { RulesService } from './rules.service';

type MockHttpService = {
  get: jest.Mock;
  post: jest.Mock;
};

const axiosResponse = <T>(data: T): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} as never },
  }) as AxiosResponse<T>;

const buildDto = (overrides: Partial<EvaluateRulesDto> = {}): EvaluateRulesDto => ({
  cobertura: 85,
  descripcion: 'Feature de autenticación',
  prIdentifier: 'JIRA-456',
  stack: [{ framework: 'angular', version: '17.3.1' }],
  rules: [
    { nombre: 'min_coverage', activa: true, config: { minCoverage: 80 } },
    { nombre: 'require_pr', activa: true, config: {} },
    { nombre: 'check_obsolescence', activa: true, config: {} },
  ],
  ...overrides,
});

describe('RulesService', () => {
  let service: RulesService;
  let httpService: MockHttpService;
  const originalIntegrationUrl = process.env.INTEGRATION_SERVICE_URL;

  beforeEach(async () => {
    const mockHttpService: MockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
    httpService = module.get<HttpService>(HttpService) as unknown as MockHttpService;

    delete process.env.INTEGRATION_SERVICE_URL;
  });

  afterEach(() => {
    if (originalIntegrationUrl === undefined) {
      delete process.env.INTEGRATION_SERVICE_URL;
    } else {
      process.env.INTEGRATION_SERVICE_URL = originalIntegrationUrl;
    }
    jest.clearAllMocks();
  });

  describe('Condición 1 — Calidad de código', () => {
    it('PASS: cobertura exactamente 80 (límite)', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 80 }));
      expect(result.conditions.calidad).toBe(true);
    });

    it('PASS: cobertura 85', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 85 }));
      expect(result.conditions.calidad).toBe(true);
    });

    it('PASS: cobertura 100', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 100 }));
      expect(result.conditions.calidad).toBe(true);
    });

    it('FAIL: cobertura 79.9 (bajo el límite)', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 79.9 }));
      expect(result.conditions.calidad).toBe(false);
    });

    it('FAIL: cobertura 0', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 0 }));
      expect(result.conditions.calidad).toBe(false);
    });

    it('usa minCoverage dinámico: si config.minCoverage=90, falla con cobertura=85', async () => {
      const result = await service.evaluate(
        buildDto({
          cobertura: 85,
          rules: [
            { nombre: 'min_coverage', activa: true, config: { minCoverage: 90 } },
            { nombre: 'require_pr', activa: true, config: {} },
            { nombre: 'check_obsolescence', activa: true, config: {} },
          ],
        }),
      );
      expect(result.conditions.calidad).toBe(false);
      expect(result.motivoRechazo).toContain('90%');
    });

    it('usa 80 como default si la regla min_coverage no está en el array', async () => {
      const passing = await service.evaluate(
        buildDto({
          cobertura: 80,
          rules: [
            { nombre: 'require_pr', activa: true, config: {} },
            { nombre: 'check_obsolescence', activa: true, config: {} },
          ],
        }),
      );
      expect(passing.conditions.calidad).toBe(true);

      const failing = await service.evaluate(
        buildDto({
          cobertura: 79,
          rules: [
            { nombre: 'require_pr', activa: true, config: {} },
            { nombre: 'check_obsolescence', activa: true, config: {} },
          ],
        }),
      );
      expect(failing.conditions.calidad).toBe(false);
      expect(failing.motivoRechazo).toContain('80%');
    });
  });

  describe('Condición 2 — Estructura: prIdentifier formato JIRA', () => {
    it('PASS: "JIRA-456"', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: 'JIRA-456' }));
      expect(result.conditions.estructura).toBe(true);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('PASS: "US-123"', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: 'US-123' }));
      expect(result.conditions.estructura).toBe(true);
    });

    it('PASS: "TICKET-1"', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: 'TICKET-1' }));
      expect(result.conditions.estructura).toBe(true);
    });

    it('FAIL: undefined', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: undefined }));
      expect(result.conditions.estructura).toBe(false);
      expect(result.motivoRechazo).toContain('identificador');
    });

    it('FAIL: string vacío ""', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: '' }));
      expect(result.conditions.estructura).toBe(false);
    });

    it('FAIL: solo espacios "   "', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: '   ' }));
      expect(result.conditions.estructura).toBe(false);
    });

    it('FAIL: descripcion vacía con prIdentifier válido', async () => {
      const result = await service.evaluate(
        buildDto({ descripcion: '', prIdentifier: 'JIRA-456' }),
      );
      expect(result.conditions.estructura).toBe(false);
      expect(result.motivoRechazo).toContain('descripción');
    });
  });

  describe('Condición 2 — Estructura: prIdentifier formato GitHub PR', () => {
    const GH_ID = 'JulianMbp/curso-blockchain-cymetria/1';
    const BASE_URL = 'http://localhost:3003';

    beforeEach(() => {
      process.env.INTEGRATION_SERVICE_URL = BASE_URL;
    });

    it('PASS: formato owner/repo/number → mock integration-service returns { exists: true }', async () => {
      httpService.get.mockReturnValue(of(axiosResponse({ exists: true })));

      const result = await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(result.conditions.estructura).toBe(true);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('FAIL: formato owner/repo/number → mock integration-service returns { exists: false }', async () => {
      httpService.get.mockReturnValue(of(axiosResponse({ exists: false })));

      const result = await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(result.conditions.estructura).toBe(false);
      expect(result.motivoRechazo).toContain('PR');
    });

    it('FAIL: integration-service lanza error → trata como exists=false', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('network down')),
      );

      const result = await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(result.conditions.estructura).toBe(false);
      expect(result.motivoRechazo).toBeDefined();
    });

    it('detecta correctamente el regex /^[\\w.-]+\\/[\\w.-]+\\/\\d+$/', async () => {
      httpService.get.mockReturnValue(of(axiosResponse({ exists: true })));

      const validSamples = [
        'owner/repo/1',
        'user-name/repo.name/42',
        'a/b/999',
        'owner_1/repo-2/10',
      ];
      for (const id of validSamples) {
        httpService.get.mockClear();
        await service.evaluate(buildDto({ prIdentifier: id }));
        expect(httpService.get).toHaveBeenCalledTimes(1);
      }

      const invalidSamples = [
        'JIRA-456',
        'owner/repo',
        'owner/repo/',
        'owner/repo/abc',
        'owner//1',
      ];
      for (const id of invalidSamples) {
        httpService.get.mockClear();
        await service.evaluate(buildDto({ prIdentifier: id }));
        expect(httpService.get).not.toHaveBeenCalled();
      }
    });

    it('NO llama al integration-service si el formato no es GitHub PR', async () => {
      await service.evaluate(buildDto({ prIdentifier: 'JIRA-456' }));
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('llama al integration-service con la URL correcta parseando owner/repo/prNumber', async () => {
      httpService.get.mockReturnValue(of(axiosResponse({ exists: true })));

      await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(httpService.get).toHaveBeenCalledWith(
        `${BASE_URL}/integrations/pr/JulianMbp/curso-blockchain-cymetria/1`,
      );
    });

    it('FAIL: falta INTEGRATION_SERVICE_URL en env con formato GitHub PR', async () => {
      delete process.env.INTEGRATION_SERVICE_URL;

      const result = await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(result.conditions.estructura).toBe(false);
      expect(httpService.get).not.toHaveBeenCalled();
      expect(result.motivoRechazo).toContain('INTEGRATION_SERVICE_URL');
    });

    it('diferencia ECONNREFUSED de otros errores axios', async () => {
      const axiosErr = Object.assign(new Error('refused'), {
        isAxiosError: true,
        code: 'ECONNREFUSED',
        name: 'AxiosError',
      }) as AxiosError;
      httpService.get.mockReturnValue(throwError(() => axiosErr));

      const result = await service.evaluate(buildDto({ prIdentifier: GH_ID }));

      expect(result.conditions.estructura).toBe(false);
      expect(result.motivoRechazo).toContain('integration-service');
    });
  });

  describe('Condición 3 — Obsolescencia de frameworks', () => {
    it('PASS: angular 17.3.1', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'angular', version: '17.3.1' }] }),
      );
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('PASS: angular 16.0.0', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'angular', version: '16.0.0' }] }),
      );
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('PASS: nestjs 10.0.0', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'nestjs', version: '10.0.0' }] }),
      );
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('FAIL: angular 13.0.0 (no está en las últimas 4 versiones)', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'angular', version: '13.0.0' }] }),
      );
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('FAIL: framework desconocido "xyz 1.0.0"', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'xyz', version: '1.0.0' }] }),
      );
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('PASS: múltiples frameworks todos soportados', async () => {
      const result = await service.evaluate(
        buildDto({
          stack: [
            { framework: 'angular', version: '17.3.1' },
            { framework: 'nestjs', version: '10.0.0' },
            { framework: 'react', version: '18.2.0' },
          ],
        }),
      );
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('FAIL: un framework no soportado entre varios soportados', async () => {
      const result = await service.evaluate(
        buildDto({
          stack: [
            { framework: 'angular', version: '17.3.1' },
            { framework: 'nestjs', version: '10.0.0' },
            { framework: 'angular', version: '13.0.0' },
          ],
        }),
      );
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('PASS: stack vacío [] (sin frameworks)', async () => {
      const result = await service.evaluate(buildDto({ stack: [] }));
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('PASS: la regla check_obsolescence está inactiva (activa: false)', async () => {
      const result = await service.evaluate(
        buildDto({
          stack: [{ framework: 'angular', version: '13.0.0' }],
          rules: [
            { nombre: 'min_coverage', activa: true, config: { minCoverage: 80 } },
            { nombre: 'require_pr', activa: true, config: {} },
            { nombre: 'check_obsolescence', activa: false, config: {} },
          ],
        }),
      );
      expect(result.conditions.obsolescencia).toBe(true);
    });
  });

  describe('Resultado combinado', () => {
    it('passed=true cuando las 3 condiciones pasan', async () => {
      const result = await service.evaluate(buildDto());
      expect(result.passed).toBe(true);
      expect(result.conditions.calidad).toBe(true);
      expect(result.conditions.estructura).toBe(true);
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('passed=false cuando solo falla calidad', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 50 }));
      expect(result.passed).toBe(false);
      expect(result.conditions.calidad).toBe(false);
      expect(result.conditions.estructura).toBe(true);
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('passed=false cuando solo falla estructura', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: '' }));
      expect(result.passed).toBe(false);
      expect(result.conditions.calidad).toBe(true);
      expect(result.conditions.estructura).toBe(false);
      expect(result.conditions.obsolescencia).toBe(true);
    });

    it('passed=false cuando solo falla obsolescencia', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'angular', version: '10.0.0' }] }),
      );
      expect(result.passed).toBe(false);
      expect(result.conditions.calidad).toBe(true);
      expect(result.conditions.estructura).toBe(true);
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('passed=false cuando fallan 2 condiciones', async () => {
      const result = await service.evaluate(
        buildDto({
          cobertura: 50,
          stack: [{ framework: 'angular', version: '10.0.0' }],
        }),
      );
      expect(result.passed).toBe(false);
      expect(result.conditions.calidad).toBe(false);
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('passed=false cuando fallan las 3 condiciones', async () => {
      const result = await service.evaluate(
        buildDto({
          cobertura: 50,
          prIdentifier: '',
          stack: [{ framework: 'angular', version: '10.0.0' }],
        }),
      );
      expect(result.passed).toBe(false);
      expect(result.conditions.calidad).toBe(false);
      expect(result.conditions.estructura).toBe(false);
      expect(result.conditions.obsolescencia).toBe(false);
    });

    it('motivoRechazo es undefined cuando passed=true', async () => {
      const result = await service.evaluate(buildDto());
      expect(result.passed).toBe(true);
      expect(result.motivoRechazo).toBeUndefined();
    });

    it('motivoRechazo menciona cobertura cuando falla calidad', async () => {
      const result = await service.evaluate(buildDto({ cobertura: 50 }));
      expect(result.motivoRechazo).toMatch(/cobertura/i);
    });

    it('motivoRechazo menciona PR/JIRA cuando falla estructura', async () => {
      const result = await service.evaluate(buildDto({ prIdentifier: '' }));
      expect(result.motivoRechazo).toMatch(/pr|jira|identificador/i);
    });

    it('motivoRechazo menciona framework cuando falla obsolescencia', async () => {
      const result = await service.evaluate(
        buildDto({ stack: [{ framework: 'angular', version: '10.0.0' }] }),
      );
      expect(result.motivoRechazo).toMatch(/framework/i);
    });

    it('conditions.calidad refleja exactamente si pasó o falló', async () => {
      const pass = await service.evaluate(buildDto({ cobertura: 90 }));
      expect(pass.conditions.calidad).toBe(true);

      const fail = await service.evaluate(buildDto({ cobertura: 10 }));
      expect(fail.conditions.calidad).toBe(false);
    });

    it('conditions.estructura refleja exactamente si pasó o falló', async () => {
      const pass = await service.evaluate(buildDto({ prIdentifier: 'JIRA-1' }));
      expect(pass.conditions.estructura).toBe(true);

      const fail = await service.evaluate(buildDto({ prIdentifier: '' }));
      expect(fail.conditions.estructura).toBe(false);
    });

    it('conditions.obsolescencia refleja exactamente si pasó o falló', async () => {
      const pass = await service.evaluate(
        buildDto({ stack: [{ framework: 'react', version: '18.0.0' }] }),
      );
      expect(pass.conditions.obsolescencia).toBe(true);

      const fail = await service.evaluate(
        buildDto({ stack: [{ framework: 'react', version: '14.0.0' }] }),
      );
      expect(fail.conditions.obsolescencia).toBe(false);
    });
  });
});
