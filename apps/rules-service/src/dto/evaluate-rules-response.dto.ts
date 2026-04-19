export class EvaluateRulesResponseDto {
  passed: boolean;
  conditions: { calidad: boolean; estructura: boolean; obsolescencia: boolean };
  motivoRechazo?: string;
}
