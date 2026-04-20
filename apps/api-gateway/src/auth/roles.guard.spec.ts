import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';

type UserLike = { role?: string; [k: string]: unknown } | undefined;

const buildContext = (user: UserLike): ExecutionContext => {
  return {
    getHandler: jest.fn().mockReturnValue(() => undefined),
    getClass: jest.fn().mockReturnValue(class {}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
};

describe('RolesGuard - canActivate()', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    const mockReflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as unknown as {
      getAllAndOverride: jest.Mock;
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sin metadata @Roles → permite el acceso (retorna true)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ role: 'approver' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('metadata @Roles con array vacío → permite el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ctx = buildContext({ role: 'approver' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('role admin + requiere admin → permite el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = buildContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('role approver + requiere admin → deniega el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = buildContext({ role: 'approver' });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('role admin + requiere approver → NO permite el acceso (comportamiento literal del guard)', () => {
    reflector.getAllAndOverride.mockReturnValue(['approver']);
    const ctx = buildContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('role admin + requiere [admin, approver] → permite el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'approver']);
    const ctx = buildContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('role approver + requiere [admin, approver] → permite el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'approver']);
    const ctx = buildContext({ role: 'approver' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('usuario sin role + requiere admin → deniega el acceso', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = buildContext({});

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('consulta metadata en handler y class (getAllAndOverride)', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = buildContext({ role: 'admin' });

    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      'roles',
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
    expect(ctx.getHandler).toHaveBeenCalled();
    expect(ctx.getClass).toHaveBeenCalled();
  });
});
