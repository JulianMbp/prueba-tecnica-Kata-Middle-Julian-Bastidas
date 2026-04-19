import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalRule,
  CreateReleaseDto,
  Release,
} from '../models/release.model';

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
