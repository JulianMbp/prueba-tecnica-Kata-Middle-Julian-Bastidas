import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

const buildContext = (): ExecutionContext =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
      getResponse: () => ({}),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
  });

  it('endpoint marcado como @Public → retorna true sin delegar a super', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const ctx = buildContext();
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      'handler',
      'class',
    ]);
  });

  it('endpoint NO público → delega en AuthGuard("jwt").canActivate', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const superSpy = jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      )
      .mockReturnValue(true as unknown as boolean);

    const ctx = buildContext();
    const result = guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalledWith(ctx);
    expect(result).toBe(true);

    superSpy.mockRestore();
  });

  it('endpoint sin metadata (undefined) → delega en super', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const superSpy = jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      )
      .mockReturnValue(true as unknown as boolean);

    const ctx = buildContext();
    const result = guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalled();
    expect(result).toBe(true);

    superSpy.mockRestore();
  });

  it('super.canActivate devuelve false → guard devuelve false', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const superSpy = jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      )
      .mockReturnValue(false as unknown as boolean);

    const ctx = buildContext();
    const result = guard.canActivate(ctx);

    expect(result).toBe(false);

    superSpy.mockRestore();
  });

  it('llama a getAllAndOverride con handler y class del contexto', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const ctx = {
      getHandler: jest.fn().mockReturnValue('h'),
      getClass: jest.fn().mockReturnValue('c'),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect(ctx.getHandler).toHaveBeenCalled();
    expect(ctx.getClass).toHaveBeenCalled();
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      'h',
      'c',
    ]);
  });
});
