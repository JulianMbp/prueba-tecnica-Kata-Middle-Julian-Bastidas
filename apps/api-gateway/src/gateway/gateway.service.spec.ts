import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { GatewayService } from './gateway.service';

const axiosResponse = <T>(
  status: number,
  data: T,
): AxiosResponse<T> => ({
  status,
  data,
  statusText: 'OK',
  headers: {},
  config: { headers: {} as never },
});

describe('GatewayService', () => {
  let service: GatewayService;
  let http: { request: jest.Mock };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    http = { request: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        { provide: HttpService, useValue: http },
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);

    process.env.RELEASE_SERVICE_URL = 'http://release-svc:3002';
    process.env.INTEGRATION_SERVICE_URL = 'http://integration-svc:3003';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  describe('proxy() → release-service', () => {
    it('GET devuelve status y data del backend', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, { ok: true })));

      const result = await service.proxy({
        method: 'GET',
        path: '/releases',
      });

      expect(result).toEqual({ status: 200, data: { ok: true } });
    });

    it('construye la URL correcta concatenando RELEASE_SERVICE_URL + path', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({ method: 'GET', path: '/releases/1' });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://release-svc:3002/releases/1',
          method: 'GET',
        }),
      );
    });

    it('elimina la barra final de RELEASE_SERVICE_URL', async () => {
      process.env.RELEASE_SERVICE_URL = 'http://release-svc:3002/';
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({ method: 'GET', path: '/releases' });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://release-svc:3002/releases' }),
      );
    });

    it('RELEASE_SERVICE_URL undefined → base vacía (url empieza por path)', async () => {
      delete process.env.RELEASE_SERVICE_URL;
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({ method: 'GET', path: '/releases' });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/releases' }),
      );
    });

    it('POST con body añade Content-Type: application/json', async () => {
      http.request.mockReturnValue(of(axiosResponse(201, { id: 10 })));

      await service.proxy({
        method: 'POST',
        path: '/releases',
        body: { equipo: 'core' },
      });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: { equipo: 'core' },
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('PATCH con body añade Content-Type: application/json', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({
        method: 'PATCH',
        path: '/rules/1',
        body: { activa: false },
      });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('GET con body no añade Content-Type', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({
        method: 'GET',
        path: '/releases',
        body: { foo: 'bar' },
      });

      const call = http.request.mock.calls[0][0] as {
        headers: Record<string, string>;
      };
      expect(call.headers['Content-Type']).toBeUndefined();
    });

    it('POST sin body no añade Content-Type', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({ method: 'POST', path: '/releases' });

      const call = http.request.mock.calls[0][0] as {
        headers: Record<string, string>;
      };
      expect(call.headers['Content-Type']).toBeUndefined();
    });

    it('propaga el header Authorization si se pasa', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({
        method: 'GET',
        path: '/releases',
        authorization: 'Bearer abc.def.ghi',
      });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer abc.def.ghi',
          }),
        }),
      );
    });

    it('no añade Authorization si no se pasa', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxy({ method: 'GET', path: '/releases' });

      const call = http.request.mock.calls[0][0] as {
        headers: Record<string, string>;
      };
      expect(call.headers.Authorization).toBeUndefined();
    });

    it('propaga status code no-2xx del backend (no lanza)', async () => {
      http.request.mockReturnValue(
        of(axiosResponse(404, { message: 'Not found' })),
      );

      const result = await service.proxy({
        method: 'GET',
        path: '/releases/999',
      });

      expect(result.status).toBe(404);
      expect(result.data).toEqual({ message: 'Not found' });
    });

    it('usa validateStatus: () => true para no lanzar en 4xx/5xx', async () => {
      http.request.mockReturnValue(of(axiosResponse(500, {})));

      await service.proxy({ method: 'GET', path: '/releases' });

      const call = http.request.mock.calls[0][0] as {
        validateStatus: (s: number) => boolean;
      };
      expect(call.validateStatus(500)).toBe(true);
      expect(call.validateStatus(200)).toBe(true);
    });

    it('error de red → lanza HttpException BAD_GATEWAY con el mensaje', async () => {
      http.request.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      await expect(
        service.proxy({ method: 'GET', path: '/releases' }),
      ).rejects.toThrow(HttpException);

      try {
        await service.proxy({ method: 'GET', path: '/releases' });
      } catch (e) {
        const err = e as HttpException;
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        const body = err.getResponse() as { message: string; detail: string };
        expect(body.message).toContain('release-service');
        expect(body.detail).toContain('ECONNREFUSED');
      }
    });

    it('error no-Error (string lanzado) → lo serializa en detail', async () => {
      http.request.mockReturnValue(throwError(() => 'boom'));

      try {
        await service.proxy({ method: 'GET', path: '/releases' });
        fail('debería haber lanzado');
      } catch (e) {
        const err = e as HttpException;
        const body = err.getResponse() as { detail: string };
        expect(body.detail).toBe('boom');
      }
    });
  });

  describe('proxyIntegration() → integration-service', () => {
    it('construye la URL con INTEGRATION_SERVICE_URL + path', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, { coverage: 85 })));

      await service.proxyIntegration({
        method: 'GET',
        path: '/github/coverage',
      });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://integration-svc:3003/github/coverage',
          method: 'GET',
        }),
      );
    });

    it('elimina la barra final de INTEGRATION_SERVICE_URL', async () => {
      process.env.INTEGRATION_SERVICE_URL = 'http://integration-svc:3003/';
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxyIntegration({ method: 'GET', path: '/x' });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://integration-svc:3003/x' }),
      );
    });

    it('propaga Authorization si se pasa', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxyIntegration({
        method: 'GET',
        path: '/x',
        authorization: 'Bearer token',
      });

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('no añade Authorization si no se pasa', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, {})));

      await service.proxyIntegration({ method: 'GET', path: '/x' });

      const call = http.request.mock.calls[0][0] as {
        headers: Record<string, string>;
      };
      expect(call.headers.Authorization).toBeUndefined();
    });

    it('devuelve status y data del backend', async () => {
      http.request.mockReturnValue(of(axiosResponse(200, { ok: 1 })));

      const result = await service.proxyIntegration({
        method: 'GET',
        path: '/ping',
      });

      expect(result).toEqual({ status: 200, data: { ok: 1 } });
    });

    it('propaga status no-2xx sin lanzar', async () => {
      http.request.mockReturnValue(of(axiosResponse(503, { err: 'down' })));

      const result = await service.proxyIntegration({
        method: 'GET',
        path: '/x',
      });

      expect(result.status).toBe(503);
    });

    it('error de red → HttpException BAD_GATEWAY mencionando integration-service', async () => {
      http.request.mockReturnValue(throwError(() => new Error('ENOTFOUND')));

      try {
        await service.proxyIntegration({ method: 'GET', path: '/x' });
        fail('debería haber lanzado');
      } catch (e) {
        const err = e as HttpException;
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        const body = err.getResponse() as { message: string; detail: string };
        expect(body.message).toContain('integration-service');
        expect(body.detail).toContain('ENOTFOUND');
      }
    });
  });
});
