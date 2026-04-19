import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(private readonly httpService: HttpService) {}

  private releaseBase(): string {
    const base = process.env.RELEASE_SERVICE_URL ?? '';
    return base.replace(/\/$/, '');
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
  }
}
