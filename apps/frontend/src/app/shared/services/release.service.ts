import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalRule,
  CreateReleaseDto,
  Release,
} from '../models/release.model';

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

export interface CoverageMetricsFromCi {
  statementsPct?: number | null;
  linesPct?: number | null;
  branchesPct?: number | null;
  functionsPct?: number | null;
}

export interface CoveragePrInfoFromCi {
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

export interface CoverageCheckRunRefFromCi {
  id: number;
  name: string;
  conclusion: string | null;
  status: string | null;
}
export interface CoverageFromCiResponse {
  found: boolean;
  coverage: number | null;
  detail?:
    | 'pr_not_found'
    | 'no_coverage_in_checks'
    | 'github_api_error'
    | 'unauthorized_or_forbidden';
  primaryMetric?: CoveragePrimaryMetric;
  source?: CoverageSource;
  pr?: CoveragePrInfoFromCi;
  metrics?: CoverageMetricsFromCi;
  checkRun?: CoverageCheckRunRefFromCi | null;
  testsSummary?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  createRelease(dto: CreateReleaseDto): Observable<Release> {
    return this.http.post<Release>(`${this.base}/releases`, dto);
  }

  getAllReleases(): Observable<Release[]> {
    return this.http.get<Release[]>(`${this.base}/releases`);
  }

  getCoverage(
    owner: string,
    repo: string,
    prNumber: string,
  ): Observable<CoverageFromCiResponse> {
    return this.http.get<CoverageFromCiResponse>(
      `${this.base}/coverage/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(prNumber)}`,
    );
  }

  approveRelease(id: string): Observable<Release> {
    return this.http.patch<Release>(`${this.base}/releases/${id}/approve`, {});
  }

  getRules(): Observable<ApprovalRule[]> {
    return this.http.get<ApprovalRule[]>(`${this.base}/rules`);
  }

  updateRule(
    id: number,
    body: { activa?: boolean; config?: Record<string, unknown> },
  ): Observable<ApprovalRule> {
    return this.http.patch<ApprovalRule>(`${this.base}/rules/${id}`, body);
  }
}
