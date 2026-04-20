/**
 * Respuesta enriquecida del endpoint de cobertura (integration-service).
 * La regla `min_coverage` del SKILL usa el porcentaje principal de pruebas (`coverage`).
 */

export type CoverageSource =
  | 'github_check'
  | 'pr_issue_comment'
  | 'check_annotation';

export type CoveragePrimaryMetric =
  | 'statements'
  | 'lines'
  | 'branches'
  | 'functions'
  | 'overall'
  | 'unknown';

export interface CoverageMetricsDto {
  statementsPct?: number | null;
  linesPct?: number | null;
  branchesPct?: number | null;
  functionsPct?: number | null;
}

export interface CoveragePrInfoDto {
  number: number;
  title: string;
  body: string | null;
  state: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  htmlUrl: string;
  userLogin?: string;
}

export interface CoverageCheckRunRefDto {
  id: number;
  name: string;
  conclusion: string | null;
  status: string | null;
}

export class CoverageResultDto {
  found!: boolean;
  coverage!: number | null;

  detail?:
    | 'pr_not_found'
    | 'no_coverage_in_checks'
    | 'github_api_error'
    | 'unauthorized_or_forbidden';

  primaryMetric?: CoveragePrimaryMetric;

  source?: CoverageSource;

  pr?: CoveragePrInfoDto;

  metrics?: CoverageMetricsDto;

  checkRun?: CoverageCheckRunRefDto | null;

  testsSummary?: string | null;
}
