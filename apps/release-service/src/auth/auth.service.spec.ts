import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';

type MockUserRepo = { findOne: jest.Mock };
type MockJwtService = { sign: jest.Mock };

const CORRECT_PASSWORD = 'correct-password-123';
const WRONG_PASSWORD = 'nope-nope-nope';
const BCRYPT_COST = 4;

const buildUser = async (overrides: Partial<User> = {}): Promise<User> => ({
  id: 'user-1',
  email: 'approver@test.com',
  password: await bcrypt.hash(CORRECT_PASSWORD, BCRYPT_COST),
  role: 'approver',
  equipo: 'payments',
  ...overrides,
});

describe('AuthService - login()', () => {
  let service: AuthService;
  let userRepo: MockUserRepo;
  let jwtService: MockJwtService;

  beforeEach(async () => {
    const mockUserRepo: MockUserRepo = { findOne: jest.fn() };
    const mockJwtService: MockJwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User)) as MockUserRepo;
    jwtService = module.get(JwtService) as unknown as MockJwtService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('login válido retorna access_token', async () => {
    const user = await buildUser();
    userRepo.findOne.mockResolvedValue(user);

    const result = await service.login(user.email, CORRECT_PASSWORD);

    expect(result.access_token).toBe('signed.jwt.token');
    expect(jwtService.sign).toHaveBeenCalledTimes(1);
  });

  it('login válido retorna datos del usuario (email, role, equipo)', async () => {
    const user = await buildUser({
      email: 'admin@test.com',
      role: 'admin',
      equipo: 'platform',
    });
    userRepo.findOne.mockResolvedValue(user);

    const result = await service.login(user.email, CORRECT_PASSWORD);

    expect(result.user).toEqual({
      email: 'admin@test.com',
      role: 'admin',
      equipo: 'platform',
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('id');
  });

  it('login con email inexistente lanza UnauthorizedException', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login('ghost@test.com', CORRECT_PASSWORD),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('login con password incorrecta lanza UnauthorizedException', async () => {
    const user = await buildUser();
    userRepo.findOne.mockResolvedValue(user);

    await expect(
      service.login(user.email, WRONG_PASSWORD),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('el token firmado contiene sub, email y role', async () => {
    const user = await buildUser({
      id: 'uuid-42',
      email: 'approver@test.com',
      role: 'approver',
    });
    userRepo.findOne.mockResolvedValue(user);

    await service.login(user.email, CORRECT_PASSWORD);

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'uuid-42',
      email: 'approver@test.com',
      role: 'approver',
    });
  });

  it('busca al usuario por email exacto', async () => {
    const user = await buildUser();
    userRepo.findOne.mockResolvedValue(user);

    await service.login(user.email, CORRECT_PASSWORD);

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { email: user.email },
    });
  });
});
