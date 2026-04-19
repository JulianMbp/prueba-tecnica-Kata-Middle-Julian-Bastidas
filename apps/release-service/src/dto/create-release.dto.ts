export class FrameworkItemDto {
  framework: string;
  version: string;
}

export class CreateReleaseDto {
  fecha: string;
  equipo: string;
  tipo: string;
  descripcion: string;
  prIdentifier?: string;
  cobertura: number;
  stack: FrameworkItemDto[];
  approverEmail: string;
}
