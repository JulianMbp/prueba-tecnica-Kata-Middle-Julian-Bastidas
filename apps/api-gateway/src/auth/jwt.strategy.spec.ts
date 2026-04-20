import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy - validate()', () => {
  let strategy: JwtStrategy;
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('payload válido → retorna { userId, email, role }', async () => {
    const payload = {
      sub: 'user-uuid-1',
      email: 'approver@test.com',
      role: 'approver',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      userId: 'user-uuid-1',
      email: 'approver@test.com',
      role: 'approver',
    });
  });

  it('extrae sub como userId', async () => {
    const payload = {
      sub: 'my-sub-42',
      email: 'x@y.com',
      role: 'admin',
    };

    const result = await strategy.validate(payload);

    expect(result.userId).toBe('my-sub-42');
    expect(result).not.toHaveProperty('sub');
  });

  it('extrae email del payload', async () => {
    const payload = {
      sub: 'any',
      email: 'user@domain.org',
      role: 'approver',
    };

    const result = await strategy.validate(payload);

    expect(result.email).toBe('user@domain.org');
  });

  it('extrae role del payload', async () => {
    const payload = {
      sub: 'any',
      email: 'x@y.com',
      role: 'admin',
    };

    const result = await strategy.validate(payload);

    expect(result.role).toBe('admin');
  });

  it('no incluye campos extra del payload en el resultado', async () => {
    const payload = {
      sub: 'uuid',
      email: 'x@y.com',
      role: 'approver',
      iat: 1700000000,
      exp: 1700003600,
      extraField: 'should be stripped',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      userId: 'uuid',
      email: 'x@y.com',
      role: 'approver',
    });
    expect(result).not.toHaveProperty('iat');
    expect(result).not.toHaveProperty('exp');
    expect(result).not.toHaveProperty('extraField');
  });
});
