import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SendEmailDto } from '../dto/send-email.dto';

@Injectable()
export class NotificationService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  async sendApprovalEmail(dto: SendEmailDto): Promise<void> {
    const subject = `[Pendiente Aprobación] Release de ${dto.equipo} — ${dto.releaseId}`;
    const html = this.buildHtml(dto);
    const from = process.env.SMTP_USER ?? '';

    try {
      await this.transporter.sendMail({
        from,
        to: dto.approverEmail,
        subject,
        html,
      });
    } catch (err) {
      console.error('Error enviando correo:', err);
    }
  }

  private buildHtml(dto: SendEmailDto): string {
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const pr = dto.prIdentifier ?? '—';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif;">
  <h2>Release pendiente de aprobación</h2>
  <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
    <tr><th align="left">Release ID</th><td>${esc(dto.releaseId)}</td></tr>
    <tr><th align="left">Equipo</th><td>${esc(dto.equipo)}</td></tr>
    <tr><th align="left">Tipo</th><td>${esc(dto.tipo)}</td></tr>
    <tr><th align="left">Descripción</th><td>${esc(dto.descripcion)}</td></tr>
    <tr><th align="left">PR / JIRA</th><td>${esc(pr)}</td></tr>
    <tr><th align="left">Email aprobador</th><td>${esc(dto.approverEmail)}</td></tr>
  </table>
  <section style="margin-top: 1.5rem; color: #b91c1c;">
    <h3 style="margin: 0 0 0.5rem 0;">Motivo de rechazo</h3>
    <p style="margin: 0;">${esc(dto.motivoRechazo)}</p>
  </section>
</body>
</html>`;
  }
}
