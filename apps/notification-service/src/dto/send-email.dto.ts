export class SendEmailDto {
  approverEmail: string;
  equipo: string;
  tipo: string;
  descripcion: string;
  prIdentifier?: string;
  motivoRechazo: string;
  releaseId: string;
}
