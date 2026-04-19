import { Injectable } from '@nestjs/common';
import { EvaluateRulesDto } from '../dto/evaluate-rules.dto';
import { EvaluateRulesResponseDto } from '../dto/evaluate-rules-response.dto';

@Injectable()
export class RulesService {
  evaluate(dto: EvaluateRulesDto): EvaluateRulesResponseDto {
    const minCoverage =
      dto.rules.find((r) => r.nombre === 'min_coverage')?.config?.minCoverage ?? 80;
    const calidad = dto.cobertura >= minCoverage;
    const estructura =
      dto.descripcion?.trim().length > 0 && !!dto.prIdentifier?.trim();

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
      motivos.push('Falta descripción o identificador de PR/JIRA');
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
