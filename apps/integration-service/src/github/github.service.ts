import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import {
  CoverageCheckRunRefDto,
  CoverageMetricsDto,
  CoveragePrInfoDto,
  CoveragePrimaryMetric,
  CoverageResultDto,
  CoverageSource,
} from '../dto/coverage-result.dto';
import { PrValidationResultDto } from '../dto/pr-validation-result.dto';

type CheckRunItem = Awaited<
  ReturnType<Octokit['checks']['listForRef']>
>['data']['check_runs'][number];

type PullRequestData = Awaited<
  ReturnType<Octokit['pulls']['get']>
>['data'];

@Injectable()
export class GithubService {
  private readonly octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async validatePR(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<PrValidationResultDto> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      return {
        exists: true,
        title: data.title,
        state: data.state,
        merged: data.merged_at != null,
      };
    } catch {
      return { exists: false };
    }
  }

  async getCoverage(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<CoverageResultDto> {
    let prData: PullRequestData | null = null;
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: Number(prNumber),
      });
      prData = pr;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        return {
          found: false,
          coverage: null,
          detail: 'unauthorized_or_forbidden',
        };
      }
      return { found: false, coverage: null, detail: 'pr_not_found' };
    }

    const prInfo = this.mapPrInfo(prData);
    const sha = prData.head.sha;

    try {
      const checkRuns = await this.listAllCheckRunsForRef(owner, repo, sha);
      const sorted = [...checkRuns].sort((a, b) => {
        const score = (name: string | null | undefined) => {
          const n = (name ?? '').toLowerCase();
          if (/codecov|cover|jest|nyc|istanbul|coverage/.test(n)) {
            return 0;
          }
          return 1;
        };
        return score(a.name) - score(b.name);
      });

      for (const check of sorted) {
        const blob = this.collectCheckBlob(check);
        const report = this.extractReportDetails(blob);
        if (report.coverage != null) {
          return this.buildSuccessResponse({
            pr: prInfo,
            report,
            source: 'github_check',
            checkRun: this.mapCheckRunRef(check),
          });
        }

        const annBlob = await this.annotationsBlob(owner, repo, check.id);
        if (annBlob) {
          const fromAnn = this.extractReportDetails(annBlob);
          if (fromAnn.coverage != null) {
            return this.buildSuccessResponse({
              pr: prInfo,
              report: fromAnn,
              source: 'check_annotation',
              checkRun: this.mapCheckRunRef(check),
            });
          }
        }
      }

      const commentBlob = await this.listAllIssueCommentBodies(
        owner,
        repo,
        Number(prNumber),
      );
      const fromComments = this.extractReportDetails(commentBlob);
      if (fromComments.coverage != null) {
        return this.buildSuccessResponse({
          pr: prInfo,
          report: fromComments,
          source: 'pr_issue_comment',
          checkRun: null,
        });
      }

      return {
        found: false,
        coverage: null,
        detail: 'no_coverage_in_checks',
        pr: prInfo,
      };
    } catch {
      return {
        found: false,
        coverage: null,
        detail: 'github_api_error',
        pr: prInfo,
      };
    }
  }

  private mapPrInfo(data: PullRequestData): CoveragePrInfoDto {
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state,
      headSha: data.head.sha,
      headRef: data.head.ref,
      baseRef: data.base.ref,
      htmlUrl: data.html_url,
      userLogin: data.user?.login,
    };
  }

  private mapCheckRunRef(check: CheckRunItem): CoverageCheckRunRefDto {
    return {
      id: check.id,
      name: check.name ?? '',
      conclusion: check.conclusion ?? null,
      status: check.status ?? null,
    };
  }

  private buildSuccessResponse(opts: {
    pr: CoveragePrInfoDto;
    report: {
      coverage: number | null;
      primaryMetric: CoveragePrimaryMetric;
      metrics: CoverageMetricsDto;
      testsSummary: string | null;
    };
    source: CoverageSource;
    checkRun: CoverageCheckRunRefDto | null;
  }): CoverageResultDto {
    const { pr, report, source, checkRun } = opts;
    const hasMetrics = Object.values(report.metrics).some(
      (v) => v != null && !Number.isNaN(v as number),
    );
    return {
      found: true,
      coverage: report.coverage,
      primaryMetric: report.primaryMetric,
      source,
      pr,
      metrics: hasMetrics ? report.metrics : undefined,
      checkRun: checkRun ?? undefined,
      testsSummary: report.testsSummary ?? undefined,
    };
  }

  private async listAllCheckRunsForRef(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<CheckRunItem[]> {
    const all: CheckRunItem[] = [];
    let page = 1;
    while (true) {
      const { data } = await this.octokit.checks.listForRef({
        owner,
        repo,
        ref,
        per_page: 100,
        page,
      });
      all.push(...data.check_runs);
      if (data.check_runs.length < 100) {
        break;
      }
      page += 1;
      if (page > 20) {
        break;
      }
    }
    return all;
  }

  private collectCheckBlob(check: CheckRunItem): string {
    return [
      check.name ?? '',
      check.output?.title ?? '',
      check.output?.summary ?? '',
      check.output?.text ?? '',
    ].join('\n');
  }

  private async annotationsBlob(
    owner: string,
    repo: string,
    checkRunId: number,
  ): Promise<string | null> {
    try {
      const { data: rows } = await this.octokit.checks.listAnnotations({
        owner,
        repo,
        check_run_id: checkRunId,
      });
      const text = rows.map((a) => a.message ?? '').join('\n');
      return text.trim() ? text : null;
    } catch {
      return null;
    }
  }

  private async listAllIssueCommentBodies(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<string> {
    const parts: string[] = [];
    let page = 1;
    while (true) {
      const { data } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page,
      });
      for (const c of data) {
        if (c.body) {
          parts.push(c.body);
        }
      }
      if (data.length < 100) {
        break;
      }
      page += 1;
      if (page > 15) {
        break;
      }
    }
    return parts.join('\n\n');
  }

  /**
   * Los comentarios del PR con `jest-coverage-report-action` suelen ser HTML; sin normalizar,
   * los porcentajes quedan en orden impredecible y el parseo puede devolver 100% en todo.
   */
  private normalizeCoverageCommentBody(raw: string): string {
    let s = raw.trim();
    if (!/<[a-z][^>]{0,240}>/i.test(s)) {
      return s;
    }
    s = s
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|table|h[1-6]|li)\s*>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/th>/gi, ' | ')
      .replace(/<hr\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#x27;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/\r\n/g, '\n');
    s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n[ \t]+/g, '\n');
    return s.trim();
  }

  /**
   * Informe tipo GitHub Action: tras "Statements" suele venir el % y más abajo "27/41" (covered/total).
   * Sirve cuando el HTML oculta el orden esperado por porcentajes.
   */
  private tryParseMetricsFromCoveredTotals(
    haystack: string,
  ): Partial<CoverageMetricsDto> {
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const one = (label: string): number | undefined => {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = haystack.match(
        new RegExp(`\\b${esc}\\b[\\s\\S]{0,1500}?(\\d+)\\s*\\/\\s*(\\d+)`, 'i'),
      );
      if (!m) {
        return undefined;
      }
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (Number.isNaN(a) || Number.isNaN(b) || b <= 0 || a > b) {
        return undefined;
      }
      return clamp((100 * a) / b);
    };
    const out: Partial<CoverageMetricsDto> = {};
    const st = one('Statements');
    const ln = one('Lines');
    const fn = one('Functions');
    const br = one('Branches');
    if (st !== undefined) {
      out.statementsPct = st;
    }
    if (ln !== undefined) {
      out.linesPct = ln;
    }
    if (fn !== undefined) {
      out.functionsPct = fn;
    }
    if (br !== undefined) {
      out.branchesPct = br;
    }
    return out;
  }

  /**
   * Si el parseo por % devuelve todo 100 pero hay ratios covered/total coherentes, sustituir por esos valores.
   */
  private applyCoveredTotalOverridesIfNeeded(
    metrics: CoverageMetricsDto,
    summaryText: string,
  ): void {
    const fromRatios = this.tryParseMetricsFromCoveredTotals(summaryText);
    if (
      fromRatios.statementsPct == null &&
      fromRatios.linesPct == null &&
      fromRatios.functionsPct == null &&
      fromRatios.branchesPct == null
    ) {
      return;
    }
    const allHundred =
      metrics.statementsPct === 100 &&
      metrics.linesPct === 100 &&
      metrics.functionsPct === 100 &&
      metrics.branchesPct === 100;
    const stmtMismatch =
      metrics.statementsPct === 100 &&
      fromRatios.statementsPct != null &&
      fromRatios.statementsPct < 99;
    if (!allHundred && !stmtMismatch) {
      return;
    }
    if (fromRatios.statementsPct != null) {
      metrics.statementsPct = fromRatios.statementsPct;
    }
    if (fromRatios.linesPct != null) {
      metrics.linesPct = fromRatios.linesPct;
    }
    if (fromRatios.functionsPct != null) {
      metrics.functionsPct = fromRatios.functionsPct;
    }
    if (fromRatios.branchesPct != null) {
      metrics.branchesPct = fromRatios.branchesPct;
    } else if (
      /\bBranches\b[\s\S]{0,500}?0\s*\/\s*0\b/i.test(summaryText) &&
      stmtMismatch
    ) {
      delete metrics.branchesPct;
    }
  }

  /**
   * Salida estándar de `jest --coverage`: fila agregada "All files | %Stmts | %Branch | %Funcs | %Lines".
   * Los números suelen ir sin `%`; es la fuente más fiable frente a tablas HTML o cabeceras "Statements|Branches".
   */
  private tryParseJestAllFilesRow(text: string): CoverageMetricsDto | null {
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const re =
      /\|?\s*All files\s*\|\s*([\d.]+)\s*%?\s*\|\s*([\d.]+)\s*%?\s*\|\s*([\d.]+)\s*%?\s*\|\s*([\d.]+)\s*%?/im;
    const m = text.match(re);
    if (!m) {
      return null;
    }
    const st = parseFloat(m[1]);
    const br = parseFloat(m[2]);
    const fn = parseFloat(m[3]);
    const ln = parseFloat(m[4]);
    if ([st, br, fn, ln].some((x) => Number.isNaN(x))) {
      return null;
    }
    return {
      statementsPct: clamp(st),
      branchesPct: clamp(br),
      functionsPct: clamp(fn),
      linesPct: clamp(ln),
    };
  }

  /** Cabecera tipo "File … Statements … Branches …" (varias métricas en una línea). */
  private lineHasMultipleMetricKeywords(line: string): boolean {
    const labels = ['Statements', 'Branches', 'Functions', 'Lines'];
    const n = labels.filter((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(line),
    ).length;
    return n >= 2;
  }

  /** Cabecera de tabla Jest en consola: `| % Stmts | % Branch | ...`. */
  private lineLooksLikeJestColumnHeader(line: string): boolean {
    return /%\s*Stmts|% Branch|% Funcs|% Lines/i.test(line);
  }

  private lineAtIndex(haystack: string, idx: number): string {
    const lineStart = haystack.lastIndexOf('\n', Math.max(0, idx - 1)) + 1;
    const lineEnd = haystack.indexOf('\n', idx);
    const end = lineEnd === -1 ? haystack.length : lineEnd;
    return haystack.slice(lineStart, end).replace(/\r$/, '');
  }

  /**
   * Igual que parseo por nombre pero ignora la palabra "Statements" en cabeceras de tabla por archivo.
   */
  private parseNamedMetricSafe(haystack: string, label: string): number | undefined {
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRe = new RegExp(`\\b${esc}\\b`, 'gi');
    const matches = [...haystack.matchAll(wordRe)];
    for (const wmatch of matches) {
      const idx = wmatch.index ?? 0;
      const line = this.lineAtIndex(haystack, idx);
      if (
        this.lineHasMultipleMetricKeywords(line) ||
        this.lineLooksLikeJestColumnHeader(line)
      ) {
        continue;
      }
      const tail = haystack.slice(idx, idx + 700);
      const sameLine = tail.match(
        new RegExp(`^\\b${esc}\\b[^\\n]*?(\\d+\\.?\\d*)%`, 'i'),
      );
      if (sameLine?.[1]) {
        const n = parseFloat(sameLine[1]);
        if (!Number.isNaN(n)) {
          return clamp(n);
        }
      }
      const multi = tail.match(
        new RegExp(`^\\b${esc}\\b[\\s\\S]{0,500}?(\\d+\\.?\\d*)%`, 'i'),
      );
      if (multi?.[1]) {
        const n = parseFloat(multi[1]);
        if (!Number.isNaN(n)) {
          return clamp(n);
        }
      }
    }
    const pipeRe = new RegExp(
      `\\|\\s*\\*{0,2}${esc}\\*{0,2}\\s*\\|\\s*(\\d+\\.?\\d*)%`,
      'i',
    );
    const pm = haystack.match(pipeRe);
    if (pm?.[1]) {
      const n = parseFloat(pm[1]);
      if (!Number.isNaN(n)) {
        return clamp(n);
      }
    }
    const legacyInline = [
      new RegExp(`${esc}\\s+(\\d+\\.?\\d*)%`, 'i'),
      new RegExp(`${esc}\\s*[:|]\\s*(\\d+\\.?\\d*)%`, 'i'),
    ];
    for (const p of legacyInline) {
      const m = haystack.match(p);
      if (m?.[1]) {
        const n = parseFloat(m[1]);
        if (!Number.isNaN(n)) {
          return clamp(n);
        }
      }
    }
    return undefined;
  }

  /**
   * Desglose Statements/Lines/… + valor principal alineado con SKILL (prioridad Statements).
   */
  private extractReportDetails(raw: string): {
    coverage: number | null;
    primaryMetric: CoveragePrimaryMetric;
    metrics: CoverageMetricsDto;
    testsSummary: string | null;
  } {
    const rawTrim = raw?.trim() ?? '';
    if (!rawTrim) {
      return {
        coverage: null,
        primaryMetric: 'unknown',
        metrics: {},
        testsSummary: null,
      };
    }

    const text = this.normalizeCoverageCommentBody(rawTrim);

    const summaryText =
      text.split(/\bShow new covered files\b/i)[0]?.trim() ?? text;

    const jestMetrics = this.tryParseJestAllFilesRow(text);

    const metrics: CoverageMetricsDto = jestMetrics
      ? { ...jestMetrics }
      : {};
    if (!jestMetrics) {
      const st = this.parseNamedMetricSafe(summaryText, 'Statements');
      const ln = this.parseNamedMetricSafe(summaryText, 'Lines');
      const br = this.parseNamedMetricSafe(summaryText, 'Branches');
      const fn = this.parseNamedMetricSafe(summaryText, 'Functions');

      if (st !== undefined) {
        metrics.statementsPct = st;
      }
      if (ln !== undefined) {
        metrics.linesPct = ln;
      }
      if (br !== undefined) {
        metrics.branchesPct = br;
      }
      if (fn !== undefined) {
        metrics.functionsPct = fn;
      }
    }

    this.applyCoveredTotalOverridesIfNeeded(metrics, summaryText);

    let coverage: number | null = null;
    let primaryMetric: CoveragePrimaryMetric = 'unknown';

    if (metrics.statementsPct != null) {
      coverage = metrics.statementsPct;
      primaryMetric = 'statements';
    } else if (metrics.linesPct != null) {
      coverage = metrics.linesPct;
      primaryMetric = 'lines';
    } else if (metrics.functionsPct != null) {
      coverage = metrics.functionsPct;
      primaryMetric = 'functions';
    } else if (metrics.branchesPct != null) {
      coverage = metrics.branchesPct;
      primaryMetric = 'branches';
    } else {
      const legacy = this.extractCoveragePercentLegacy(text);
      if (legacy != null) {
        coverage = legacy;
        primaryMetric = 'overall';
      }
    }

    const testsMatch = text.match(/[^\n]*\d+\s+tests?\s+passing[^\n]*/i);
    const testsSummary = testsMatch ? testsMatch[0].trim() : null;

    return { coverage, primaryMetric, metrics, testsSummary };
  }

  private extractCoveragePercentLegacy(raw: string): number | null {
    const text = raw?.trim() ?? '';
    if (!text) {
      return null;
    }

    const clamp = (n: number) => Math.min(100, Math.max(0, n));

    const tryGroup = (m: RegExpMatchArray | null, group = 1): number | null => {
      if (!m?.[group]) {
        return null;
      }
      const n = parseFloat(m[group]);
      if (Number.isNaN(n)) {
        return null;
      }
      return clamp(n);
    };

    const patterns: RegExp[] = [
      /^\s*\|\s*\*{0,2}Statements\*{0,2}\s*\|\s*(\d+\.?\d*)%\s*\|/im,
      /^\s*\|\s*\*{0,2}Lines\*{0,2}\s*\|\s*(\d+\.?\d*)%\s*\|/im,
      /^\s*\|\s*Statements\s*\|\s*(\d+\.?\d*)\s*\|/im,
      /^\s*\|\s*Lines\s*\|\s*(\d+\.?\d*)\s*\|/im,
      /\|\s*All files\s*\|\s*(\d+\.?\d*)\s*\|/i,
      /%?\s*Stmts\s*\|\s*(\d+\.?\d*)/i,
      /Statements[^|\n]*\|\s*(\d+\.?\d*)%/i,
      /Lines[^|\n]*\|\s*(\d+\.?\d*)%/i,
      /Statements\s*[:|]\s*(\d+\.?\d*)\s*%/i,
      /Lines\s*[:|]\s*(\d+\.?\d*)\s*%/i,
      /Branches\s*[:|]\s*(\d+\.?\d*)\s*%/i,
      /coverage[:\s#`>*-]*(\d+\.?\d*)\s*%/i,
      /(\d+\.?\d*)\s*%\s*(?:coverage|statements?|lines?|diff)/i,
      /(?:overall|total)\s+coverage[:\s]+(\d+\.?\d*)\s*%/i,
      /diff\s+coverage[:\s]+(\d+\.?\d*)\s*%/i,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      const v = tryGroup(m);
      if (v != null) {
        return v;
      }
    }

    for (const line of text.split(/\n/)) {
      const l = line.trim();
      if (
        !/coverage|statement|lines|branch|total|all files|diff|jest|nyc/i.test(
          l,
        )
      ) {
        continue;
      }
      const labeled = l.match(
        /\bStatements\b[^%]*?(\d+\.?\d*)%|\bLines\b[^%]*?(\d+\.?\d*)%/i,
      );
      if (labeled) {
        const raw = labeled[1] ?? labeled[2];
        if (raw) {
          const n = parseFloat(raw);
          if (!Number.isNaN(n) && n > 0 && n <= 100) {
            return clamp(n);
          }
        }
      }
      const m = l.match(/(\d+\.?\d*)\s*%/);
      if (m?.[1] && !/\|.*\|.*\|/.test(l)) {
        const n = parseFloat(m[1]);
        if (!Number.isNaN(n) && n > 0 && n <= 100) {
          return clamp(n);
        }
      }
    }

    return null;
  }
}
