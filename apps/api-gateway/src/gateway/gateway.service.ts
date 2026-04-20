import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(private readonly httpService: HttpService) {}

  private releaseBase(): string {
    const base = process.env.RELEASE_SERVICE_URL ?? '';
    return base.replace(/\/$/, '');
  }

  private integrationBase(): string {
    const base = process.env.INTEGRATION_SERVICE_URL ?? '';
    return base.replace(/\/$/, '');
  }

  /**
   * Proxy HTTP al integration-service (p. ej. cobertura desde GitHub Checks).
   */
  async proxyIntegration(options: {
    method: 'GET';
    path: string;
    authorization?: string;
  }): Promise<{ status: number; data: unknown }> {
    const url = `${this.integrationBase()}${options.path}`;
    const headers: Record<string, string> = {};
    if (options.authorization) {
      headers['Authorization'] = options.authorization;
    }

    try {
      const { status, data } = await firstValueFrom(
        this.httpService.request({
          method: options.method,
          url,
          headers,
          validateStatus: () => true,
        }),
      );
      return { status, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        {
          message: 'No se pudo contactar con integration-service',
          detail: msg,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Proxy HTTP al release-service: reenvía body, propaga status code y cuerpo de respuesta.
   */
  async proxy(options: {
    method: 'GET' | 'POST' | 'PATCH';
    path: string;
    body?: unknown;
    authorization?: string;
  }): Promise<{ status: number; data: unknown }> {
    const url = `${this.releaseBase()}${options.path}`;
    const headers: Record<string, string> = {};
    if (options.authorization) {
      headers['Authorization'] = options.authorization;
    }
    if (
      options.body !== undefined &&
      ['POST', 'PATCH'].includes(options.method)
    ) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const { status, data } = await firstValueFrom(
        this.httpService.request({
          method: options.method,
          url,
          data: options.body,
          headers,
          validateStatus: () => true,
        }),
      );
      return { status, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        {
          message: 'No se pudo contactar con release-service',
          detail: msg,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
