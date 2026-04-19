export interface FrameworkItem {
  framework: string;
  version: string;
}

export interface CreateReleaseDto {
  fecha: string;
  equipo: string;
  tipo: 'rs' | 'fx' | 'cv';
  descripcion: string;
  prIdentifier?: string;
  cobertura: number;
  stack: FrameworkItem[];
  approverEmail: string;
}

export interface Release {
  id: string;
  fecha: string;
  equipo: string;
  tipo: string;
  descripcion: string;
  prIdentifier?: string;
  cobertura: number;
  stack: FrameworkItem[];
  estado: string;
  aprobacionAutomatica: boolean;
  motivoRechazo?: string;
  approverEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRule {
  id: number;
  nombre: string;
  descripcion: string;
  activa: boolean;
  config: Record<string, unknown> | null;
  updatedAt: string;
}
