import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    pulls: { get: jest.fn() },
    checks: { listForRef: jest.fn(), listAnnotations: jest.fn() },
    issues: { listComments: jest.fn() },
  })),
}));

import { GithubService } from './github.service';

type MockOctokit = {
  pulls: { get: jest.Mock };
  checks: { listForRef: jest.Mock; listAnnotations: jest.Mock };
  issues: { listComments: jest.Mock };
};

const buildMockOctokit = (): MockOctokit => ({
  pulls: { get: jest.fn() },
  checks: { listForRef: jest.fn(), listAnnotations: jest.fn() },
  issues: { listComments: jest.fn() },
});

const prDataFixture = (overrides: Record<string, unknown> = {}) => ({
  number: 1,
  title: 'PR de prueba',
  body: 'descripción',
  state: 'open',
  html_url: 'https://github.com/o/r/pull/1',
  merged_at: null,
  head: { sha: 'abc123sha', ref: 'feature/x' },
  base: { ref: 'main' },
  user: { login: 'julian' },
  ...overrides,
});

describe('GithubService', () => {
  let service: GithubService;
  let octokit: MockOctokit;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GithubService],
    }).compile();

    service = module.get<GithubService>(GithubService);
    octokit = buildMockOctokit();
    (service as unknown as { octokit: MockOctokit }).octokit = octokit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePR()', () => {
    it('PR existe → retorna { exists: true, title, state, merged }', async () => {
      octokit.pulls.get.mockResolvedValue({
        data: prDataFixture({
          title: 'Fix auth',
          state: 'open',
          merged_at: null,
        }),
      });

      const result = await service.validatePR('o', 'r', 1);

      expect(result).toEqual({
        exists: true,
        title: 'Fix auth',
        state: 'open',
        merged: false,
      });
      expect(octokit.pulls.get).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        pull_number: 1,
      });
    });

    it('PR no existe (404) → retorna { exists: false }', async () => {
      octokit.pulls.get.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 }),
      );

      const result = await service.validatePR('o', 'r', 999);

      expect(result).toEqual({ exists: false });
    });

    it('error de red → retorna { exists: false }', async () => {
      octokit.pulls.get.mockRejectedValue(new Error('ECONNRESET'));

      const result = await service.validatePR('o', 'r', 1);

      expect(result).toEqual({ exists: false });
    });

    it('PR mergeado → merged=true', async () => {
      octokit.pulls.get.mockResolvedValue({
        data: prDataFixture({
          state: 'closed',
          merged_at: '2025-01-15T10:00:00Z',
        }),
      });

      const result = await service.validatePR('o', 'r', 1);

      expect(result.merged).toBe(true);
    });

    it('PR abierto → merged=false, state="open"', async () => {
      octokit.pulls.get.mockResolvedValue({
        data: prDataFixture({ state: 'open', merged_at: null }),
      });

      const result = await service.validatePR('o', 'r', 1);

      expect(result.merged).toBe(false);
      expect(result.state).toBe('open');
    });
  });

  describe('getCoverage()', () => {
    const setupPrOk = (overrides: Record<string, unknown> = {}) => {
      octokit.pulls.get.mockResolvedValue({
        data: prDataFixture(overrides),
      });
    };

    const checkRunFixture = (overrides: {
      id?: number;
      name?: string;
      output?: { title?: string; summary?: string; text?: string };
      conclusion?: string | null;
      status?: string | null;
    } = {}) => ({
      id: overrides.id ?? 1,
      name: overrides.name ?? 'jest coverage',
      conclusion: overrides.conclusion ?? 'success',
      status: overrides.status ?? 'completed',
      output: {
        title: overrides.output?.title ?? null,
        summary: overrides.output?.summary ?? null,
        text: overrides.output?.text ?? null,
      },
    });

    it('check run con cobertura en formato "Statements | 90.9%" → { found: true, coverage: 90.9 }', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: { summary: 'Statements | 90.9%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(90.9, 1);
    });

    it('check run con "coverage: 85%" → { found: true, coverage: 85 }', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'ci',
              output: { summary: 'Overall coverage: 85%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(85);
    });

    it('check run sin datos de cobertura → { found: false, coverage: null }', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'lint',
              output: { summary: 'No lint errors found' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({ data: [] });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.coverage).toBeNull();
    });

    it('sin check runs → { found: false, coverage: null }', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.coverage).toBeNull();
    });

    it('error de Octokit en pulls.get → { found: false, coverage: null }', async () => {
      octokit.pulls.get.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 }),
      );

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.coverage).toBeNull();
      expect(result.detail).toBe('pr_not_found');
      expect(octokit.checks.listForRef).not.toHaveBeenCalled();
    });

    it('error de Octokit en listForRef tras pulls.get exitoso → { found: false, coverage: null }', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockRejectedValue(new Error('rate limit'));

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.coverage).toBeNull();
      expect(result.detail).toBe('github_api_error');
    });

    it('obtiene el SHA del HEAD del PR antes de buscar check runs', async () => {
      setupPrOk({ head: { sha: 'deadbeef42', ref: 'feature/x' } });
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      await service.getCoverage('o', 'r', 1);

      expect(octokit.pulls.get).toHaveBeenCalledTimes(1);
      expect(octokit.checks.listForRef).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'o',
          repo: 'r',
          ref: 'deadbeef42',
        }),
      );

      const pullsGetOrder = octokit.pulls.get.mock.invocationCallOrder[0];
      const listForRefOrder =
        octokit.checks.listForRef.mock.invocationCallOrder[0];
      expect(pullsGetOrder).toBeLessThan(listForRefOrder);
    });

    it('falla cobertura en check runs → fallback a comentarios del PR', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'lint',
              output: { summary: 'all good' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({ data: [] });
      octokit.issues.listComments.mockResolvedValue({
        data: [{ body: 'Coverage: 77.5%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(77.5);
      expect(result.source).toBe('pr_issue_comment');
    });

    it('pulls.get responde 401 → detail="unauthorized_or_forbidden"', async () => {
      octokit.pulls.get.mockRejectedValue(
        Object.assign(new Error('Bad credentials'), { status: 401 }),
      );

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.detail).toBe('unauthorized_or_forbidden');
    });

    it('pulls.get responde 403 → detail="unauthorized_or_forbidden"', async () => {
      octokit.pulls.get.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { status: 403 }),
      );

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.detail).toBe('unauthorized_or_forbidden');
    });

    it('prioriza el check run con nombre "coverage" sobre otros al parsear', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              id: 10,
              name: 'lint',
              output: { summary: 'Statements | 50%' },
            }),
            checkRunFixture({
              id: 20,
              name: 'jest-coverage',
              output: { summary: 'Statements | 92%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(92);
      expect(result.checkRun?.id).toBe(20);
    });

    it('annotations del check run aportan la cobertura cuando el blob del check no la tiene', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              id: 77,
              name: 'ci',
              output: { summary: 'build passed' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({
        data: [{ message: 'Statements | 88.2%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(88.2, 1);
      expect(result.source).toBe('check_annotation');
    });

    it('listAnnotations lanza error → ignora annotations y continúa al fallback', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              id: 77,
              name: 'ci',
              output: { summary: 'build passed' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockRejectedValue(
        new Error('annotations api error'),
      );
      octokit.issues.listComments.mockResolvedValue({
        data: [{ body: 'Coverage: 65%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(65);
      expect(result.source).toBe('pr_issue_comment');
    });

    it('annotations con mensajes vacíos → trata blob como null y no lo usa', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({ name: 'ci', output: { summary: 'x' } }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({
        data: [{ message: '' }, { message: null }, {}],
      });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.detail).toBe('no_coverage_in_checks');
    });

    it('comentario HTML de jest-coverage-report-action → normaliza y extrae', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [
          {
            body: '<div><p>Summary</p><table><tr><td>Statements</td><td>82.5%</td></tr></table></div>',
          },
        ],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(82.5, 1);
    });

    it('comentario HTML con <script>, <style>, &nbsp; → los limpia antes de parsear', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [
          {
            body: '<div><script>alert(1)</script><style>.x{}</style>Coverage:&nbsp;73%</div>',
          },
        ],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(73);
    });

    it('formato "| All files | 75.5 | 60 | 80 | 75 |" (fila Jest) → extrae statements=75.5', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: {
                summary:
                  '| File | % Stmts | % Branch | % Funcs | % Lines |\n|---|---|---|---|---|\n| All files | 75.5 | 60 | 80 | 75 |',
              },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(75.5);
      expect(result.metrics?.statementsPct).toBe(75.5);
      expect(result.metrics?.branchesPct).toBe(60);
      expect(result.metrics?.functionsPct).toBe(80);
      expect(result.metrics?.linesPct).toBe(75);
    });

    it('formato covered/total "Statements 27/41" → calcula porcentaje y sustituye metrics al 100%', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: {
                summary:
                  'Statements 100% 27/41\nLines 100% 27/41\nFunctions 100% 10/15\nBranches 100% 5/10',
              },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo((100 * 27) / 41, 0);
      expect(result.metrics?.statementsPct).toBeLessThan(100);
    });

    it('solo tiene Lines en el blob → coverage=linesPct, primaryMetric=lines', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: { summary: 'Lines: 88%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(88);
      expect(result.primaryMetric).toBe('lines');
    });

    it('blob vacío (null output) + comentario con %coverage legacy → usa parser legacy', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [{ body: '## Results\nOverall coverage: 72.3%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(72.3, 1);
    });

    it('múltiples páginas de check runs → paginación correcta', async () => {
      setupPrOk();
      const page1 = Array.from({ length: 100 }, (_, i) =>
        checkRunFixture({
          id: i + 1,
          name: `check-${i + 1}`,
          output: { summary: 'nothing' },
        }),
      );
      const page2 = [
        checkRunFixture({
          id: 101,
          name: 'coverage',
          output: { summary: 'Statements | 91%' },
        }),
      ];
      octokit.checks.listForRef
        .mockResolvedValueOnce({ data: { check_runs: page1 } })
        .mockResolvedValueOnce({ data: { check_runs: page2 } });
      octokit.checks.listAnnotations.mockResolvedValue({ data: [] });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(91);
      expect(octokit.checks.listForRef).toHaveBeenCalledTimes(2);
    });

    it('múltiples páginas de comentarios PR → concatena todos los bodies', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      const commentsPage1 = Array.from({ length: 100 }, (_, i) => ({
        body: `comment ${i + 1}`,
      }));
      const commentsPage2 = [{ body: 'Coverage: 84%' }];
      octokit.issues.listComments
        .mockResolvedValueOnce({ data: commentsPage1 })
        .mockResolvedValueOnce({ data: commentsPage2 });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(84);
      expect(octokit.issues.listComments).toHaveBeenCalledTimes(2);
    });

    it('comentario sin body es ignorado (c.body falsy)', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [{ body: null }, { body: '' }, { body: 'Coverage: 55%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(55);
    });

    it('ratio covered/total con números inválidos (a > b) → ignora ese label', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: { summary: 'Statements 100% 50/10' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({ data: [] });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(100);
    });

    it('solo cobertura como "50% diff" → usa patrón legacy', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [{ body: 'diff coverage: 65.5%' }],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(65.5, 1);
    });

    it('ratios con Branches 0/0 y stmtMismatch → elimina branchesPct', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: {
                summary:
                  '| File | % Stmts | % Branch | % Funcs | % Lines |\n|---|---|---|---|---|\n| All files | 100 | 100 | 100 | 100 |\nStatements 20/30\nBranches 0/0',
              },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.metrics?.branchesPct).toBeUndefined();
      expect(result.metrics?.statementsPct).toBeLessThan(100);
    });

    it('solo tiene Branches en el blob → coverage=branchesPct, primaryMetric=branches', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: { summary: 'Branches: 55%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(55);
      expect(result.primaryMetric).toBe('branches');
    });

    it('solo tiene Functions en el blob → coverage=functionsPct, primaryMetric=functions', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: { summary: 'Functions: 70%' },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(70);
      expect(result.primaryMetric).toBe('functions');
    });

    it('ignora la palabra "Statements" en cabeceras de tabla por archivo', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: {
                summary:
                  'File | Statements | Branches | Functions | Lines\nsrc/foo.ts | Statements: 42%',
              },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(42);
    });

    it('blob con formato pipe "| Statements | 77.5% |" → extrae 77.5', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'coverage',
              output: {
                summary:
                  'Algo en el medio\n| Statements | 77.5% |\n| Lines | 80% |',
              },
            }),
          ],
        },
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBeCloseTo(77.5, 1);
    });

    it('comentario PR con "Statements ... 88%" inline → parser legacy extrae 88', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      octokit.issues.listComments.mockResolvedValue({
        data: [
          {
            body: '## Coverage report\nStatements inline check: 88%',
          },
        ],
      });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(true);
      expect(result.coverage).toBe(88);
    });

    it('blob sin cobertura y sin annotations ni comentarios → detail=no_coverage_in_checks', async () => {
      setupPrOk();
      octokit.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            checkRunFixture({
              name: 'lint',
              output: { summary: 'lint ok' },
            }),
          ],
        },
      });
      octokit.checks.listAnnotations.mockResolvedValue({ data: [] });
      octokit.issues.listComments.mockResolvedValue({ data: [] });

      const result = await service.getCoverage('o', 'r', 1);

      expect(result.found).toBe(false);
      expect(result.detail).toBe('no_coverage_in_checks');
      expect(result.pr).toBeDefined();
    });
  });
});
