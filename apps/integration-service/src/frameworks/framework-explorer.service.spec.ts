import { Test, TestingModule } from '@nestjs/testing';
import { FrameworkExplorerService } from './framework-explorer.service';

const mockFetchNotOk = () => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({}),
  });
};

const mockFetchWithVersions = (versions: string[]) => {
  const versionsObj = Object.fromEntries(versions.map((v) => [v, {}]));
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ versions: versionsObj }),
  });
};

const mockFetchThrows = () => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest
    .fn()
    .mockRejectedValue(new Error('network down'));
};

describe('FrameworkExplorerService - checkFrameworks()', () => {
  let service: FrameworkExplorerService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FrameworkExplorerService],
    }).compile();

    service = module.get<FrameworkExplorerService>(FrameworkExplorerService);
  });

  afterEach(() => {
    (global as unknown as { fetch: typeof originalFetch }).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('angular 17.3.1 → supported=true', async () => {
    const result = await service.checkFrameworks([
      { framework: 'angular', version: '17.3.1' },
    ]);

    expect(result).toEqual([
      { framework: 'angular', version: '17.3.1', supported: true },
    ]);
  });

  it('angular 13.0.0 → supported=false', async () => {
    mockFetchNotOk();

    const result = await service.checkFrameworks([
      { framework: 'angular', version: '13.0.0' },
    ]);

    expect(result[0].supported).toBe(false);
    expect(result[0].framework).toBe('angular');
    expect(result[0].version).toBe('13.0.0');
  });

  it('nestjs 10.0.0 → supported=true', async () => {
    const result = await service.checkFrameworks([
      { framework: 'nestjs', version: '10.0.0' },
    ]);

    expect(result).toEqual([
      { framework: 'nestjs', version: '10.0.0', supported: true },
    ]);
  });

  it('framework desconocido → supported=false con reason descriptiva', async () => {
    mockFetchNotOk();

    const result = await service.checkFrameworks([
      { framework: 'xyz', version: '1.0.0' },
    ]);

    expect(result[0].supported).toBe(false);
    expect(result[0].reason).toBeDefined();
    expect(result[0].reason).toMatch(/no encontrado|npm|catálogo/i);
  });

  it('stack vacío [] → retorna array vacío', async () => {
    const result = await service.checkFrameworks([]);

    expect(result).toEqual([]);
  });

  it('múltiples frameworks → retorna resultado por cada uno', async () => {
    mockFetchNotOk();

    const result = await service.checkFrameworks([
      { framework: 'angular', version: '17.3.1' },
      { framework: 'nestjs', version: '10.0.0' },
      { framework: 'angular', version: '13.0.0' },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      framework: 'angular',
      version: '17.3.1',
      supported: true,
    });
    expect(result[1]).toEqual({
      framework: 'nestjs',
      version: '10.0.0',
      supported: true,
    });
    expect(result[2].supported).toBe(false);
    expect(result[2].framework).toBe('angular');
    expect(result[2].version).toBe('13.0.0');
  });

  it('extrae correctamente el major version del semver (17.3.1 → "17")', async () => {
    const result = await service.checkFrameworks([
      { framework: 'angular', version: '17.3.1' },
      { framework: 'angular', version: '17.0.0' },
      { framework: 'angular', version: '17.99.99-beta.1' },
    ]);

    expect(result.every((r) => r.supported === true)).toBe(true);
  });

  it('framework case-insensitive: "Angular" mayúsculas → supported=true', async () => {
    const result = await service.checkFrameworks([
      { framework: 'Angular', version: '17.3.1' },
    ]);

    expect(result[0].supported).toBe(true);
  });

  it('fallback npm devuelve version publicada → supported=true', async () => {
    mockFetchWithVersions(['13.0.0', '14.0.0']);

    const result = await service.checkFrameworks([
      { framework: 'angular', version: '13.0.0' },
    ]);

    expect(result[0].supported).toBe(true);
  });

  it('fallback npm falla con error de red → supported=false con reason', async () => {
    mockFetchThrows();

    const result = await service.checkFrameworks([
      { framework: 'angular', version: '13.0.0' },
    ]);

    expect(result[0].supported).toBe(false);
    expect(result[0].reason).toMatch(/error|npm/i);
  });
});
