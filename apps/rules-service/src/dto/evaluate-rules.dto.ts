export class FrameworkItemDto {
  framework: string;
  version: string;
}

export class RuleConfigDto {
  nombre: string;
  activa: boolean;
  config: Record<string, any>;
}

export class EvaluateRulesDto {
  cobertura: number;
  descripcion: string;
  prIdentifier?: string;
  stack: FrameworkItemDto[];
  rules: RuleConfigDto[];
}
