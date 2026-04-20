import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';
import { Release } from '../entities/release.entity';

type EvaluateRulesResponse = {
  passed: boolean;
  motivoRechazo?: string;
  conditions?: unknown;
};

@Injectable()
export class ReleaseManager {
  constructor(
    private httpService: HttpService,
    @InjectRepository(ApprovalRule) private rulesRepo: Repository<ApprovalRule>,
  ) {}

  /** Node puede lanzar AggregateError (p. ej. ECONNREFUSED en IPv4 e IPv6). */
  private formatRulesCallError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const st = err.response?.status;
      if (st) {
        return `HTTP ${st}`;
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return `${err.code}: ¿rules-service levantado y RULES_SERVICE_URL correcta?`;
      }
      return err.message;
    }
    if (typeof AggregateError !== 'undefined' && err instanceof AggregateError) {
      return err.errors
        .map((e) => (e instanceof Error ? e.message : String(e)))
        .join('; ');
    }
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  async process(release: Release): Promise<Partial<Release>> {
    if (release.tipo !== 'rs') {
      return { estado: 'approved', aprobacionAutomatica: false };
    }

    const activeRules = await this.rulesRepo.find({ where: { activa: true } });

    const base = process.env.RULES_SERVICE_URL?.replace(/\/$/, '') ?? '';
    if (!base) {
      return {
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo:
          'RULES_SERVICE_URL no está configurado en release-service',
      };
    }

    const url = `${base}/rules/evaluate`;
    const body = {
      cobertura: release.cobertura,
      descripcion: release.descripcion,
      prIdentifier: release.prIdentifier,
      stack: release.stack,
      rules: activeRules,
    };

    try {
      const res = await firstValueFrom(
        this.httpService.post<EvaluateRulesResponse>(url, body, {
          validateStatus: () => true,
        }),
      );

      if (res.status < 200 || res.status >= 300) {
        return {
          estado: 'pending',
          aprobacionAutomatica: false,
          motivoRechazo: `rules-service respondió ${res.status} al evaluar reglas`,
        };
      }

      const data = res.data;
      if (data?.passed === true) {
        return { estado: 'approved', aprobacionAutomatica: true };
      }

      return {
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: data?.motivoRechazo,
      };
    } catch (err) {
      return {
        estado: 'pending',
        aprobacionAutomatica: false,
        motivoRechazo: `No se pudo contactar rules-service: ${this.formatRulesCallError(err)}`,
      };
    }
  }
}
