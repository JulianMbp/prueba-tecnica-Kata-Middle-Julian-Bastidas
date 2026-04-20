import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { EvaluateRulesDto } from '../dto/evaluate-rules.dto';
import { EvaluateRulesResponseDto } from '../dto/evaluate-rules-response.dto';

/** Formato GitHub: owner/repo/número (ej. JulianMbp/curso-blockchain-cymetria/1) */
const GITHUB_PR_REGEX = /^([\w.-]+)\/([\w.-]+)\/(\d+)$/;

@Injectable()
export class RulesService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Valida el identificador de PR/JIRA para la condición de estructura.
   * - Vacío → inválido
   * - Formato GitHub → comprueba existencia vía integration-service
   * - Otro texto no vacío (JIRA, etc.) → válido
   */
  private async validatePrIdentifier(
    prIdentifier: string | undefined,
    integrationServiceUrl: string | undefined,
  ): Promise<{ valid: boolean; reason?: string }> {
    const trimmed = prIdentifier?.trim() ?? '';
    if (trimmed.length === 0) {
      return { valid: false, reason: 'Falta identificador de PR/JIRA' };
    }

    const gh = trimmed.match(GITHUB_PR_REGEX);
    if (!gh) {
      return { valid: true };
    }

    const [, owner, repo, numStr] = gh;
    const prNumber = parseInt(numStr, 10);
    const base = integrationServiceUrl?.replace(/\/$/, '') ?? '';
    if (!base) {
      return {
        valid: false,
        reason:
          'Falta INTEGRATION_SERVICE_URL en el rules-service (sin eso no se puede comprobar el PR)',
      };
    }

    const url = `${base}/integrations/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${prNumber}`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ exists: boolean }>(url),
      );
      if (data.exists === true) {
        return { valid: true };
      }
      return {
        valid: false,
        reason:
          'PR no encontrado en GitHub (o el token no tiene acceso al repositorio)',
      };
    } catch (err: unknown) {
      return {
        valid: false,
        reason: this.describeIntegrationCallFailure(err),
      };
    }
  }

  /** Detalle para distinguir “servicio caído” de “URL mal configurada”. */
  private describeIntegrationCallFailure(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const code = err.code;
      const status = err.response?.status;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        return `No responde integration-service en INTEGRATION_SERVICE_URL (${code}). ¿Está levantado y la URL es correcta?`;
      }
      if (status === 401 || status === 403) {
        return 'integration-service respondió sin autorización (revisa GITHUB_TOKEN en integration-service)';
      }
      if (status != null) {
        return `integration-service respondió HTTP ${status} al validar el PR`;
      }
      if (err.message?.includes('timeout')) {
        return 'Timeout al llamar a integration-service para validar el PR';
      }
    }
    return 'Error al llamar a integration-service para validar el PR (revisa logs del rules-service)';
  }

  async evaluate(dto: EvaluateRulesDto): Promise<EvaluateRulesResponseDto> {
    const minCoverage =
      dto.rules.find((r) => r.nombre === 'min_coverage')?.config?.minCoverage ??
      80;
    const calidad = dto.cobertura >= minCoverage;

    const descOk = (dto.descripcion?.trim().length ?? 0) > 0;
    const prResult = await this.validatePrIdentifier(
      dto.prIdentifier,
      process.env.INTEGRATION_SERVICE_URL,
    );
    const estructura = descOk && prResult.valid;

    const checkRule = dto.rules.find((r) => r.nombre === 'check_obsolescence');
    let obsolescencia = true;
    if (checkRule?.activa) {
      const supported = require('./supported-versions.json');
      obsolescencia = dto.stack.every((item) => {
        const major = item.version.split('.')[0];
        return supported[item.framework.toLowerCase()]?.includes(major) ?? false;
      });
    }

    const motivos: string[] = [];
    if (!calidad) {
      motivos.push(
        `Cobertura insuficiente: ${dto.cobertura}% (mínimo ${minCoverage}%)`,
      );
    }
    if (!estructura) {
      if (!descOk) {
        motivos.push('Falta descripción');
      }
      if (!prResult.valid && prResult.reason) {
        motivos.push(prResult.reason);
      }
    }
    if (!obsolescencia) {
      motivos.push(
        'Uno o más frameworks no están en las últimas 4 versiones soportadas',
      );
    }

    return {
      passed: calidad && estructura && obsolescencia,
      conditions: { calidad, estructura, obsolescencia },
      motivoRechazo: motivos.join('. ') || undefined,
    };
  }
}
