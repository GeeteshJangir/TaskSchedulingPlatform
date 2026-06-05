import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<
      UsersService,
      'existsByEmail' | 'create' | 'findByEmailWithSecret' | 'findById'
    >
  >;
  let passwords: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;
  let refreshTokens: jest.Mocked<
    Pick<RefreshTokenService, 'issueForNewSession' | 'rotate' | 'revoke'>
  >;

  beforeEach(async () => {
    users = {
      existsByEmail: jest.fn(),
      create: jest.fn(),
      findByEmailWithSecret: jest.fn(),
      findById: jest.fn(),
    } as never;
    passwords = { hash: jest.fn(), verify: jest.fn() } as never;
    refreshTokens = {
      issueForNewSession: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
    } as never;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: RefreshTokenService, useValue: refreshTokens },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('access.jwt') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('signup() rejects a duplicate email', async () => {
    users.existsByEmail.mockResolvedValue(true);
    await expect(
      service.signup({ email: 'a@b.com', name: 'A', password: 'password1' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('signup() hashes the password, creates the user, and issues tokens', async () => {
    users.existsByEmail.mockResolvedValue(false);
    passwords.hash.mockResolvedValue('hashed');
    users.create.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
    } as never);
    refreshTokens.issueForNewSession.mockResolvedValue('refresh.raw');

    const res = await service.signup(
      { email: 'a@b.com', name: 'A', password: 'password1' },
      {},
    );

    expect(passwords.hash).toHaveBeenCalledWith('password1');
    expect(users.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'hashed',
    });
    expect(res).toEqual({
      tokenType: 'Bearer',
      accessToken: 'access.jwt',
      refreshToken: 'refresh.raw',
      user: { id: 'u1', email: 'a@b.com', name: 'A' },
    });
  });

  it('login() rejects a wrong password', async () => {
    users.findByEmailWithSecret.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      isActive: true,
      passwordHash: 'hashed',
    } as never);
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() issues tokens on valid credentials', async () => {
    users.findByEmailWithSecret.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      isActive: true,
      passwordHash: 'hashed',
    } as never);
    passwords.verify.mockResolvedValue(true);
    refreshTokens.issueForNewSession.mockResolvedValue('refresh.raw');

    const res = await service.login(
      { email: 'a@b.com', password: 'password1' },
      {},
    );
    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken).toBe('refresh.raw');
  });
});
