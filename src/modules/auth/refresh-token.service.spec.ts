import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

type RepoMock = jest.Mocked<
  Pick<Repository<RefreshToken>, 'findOne' | 'save' | 'create' | 'update'>
>;

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x as RefreshToken),
      update: jest.fn(),
    } as unknown as RepoMock;

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: getRepositoryToken(RefreshToken), useValue: repo },
        { provide: ConfigService, useValue: { get: () => '7d' } },
      ],
    }).compile();

    service = moduleRef.get(RefreshTokenService);
  });

  it('issueForNewSession() persists a token and returns the raw value', async () => {
    const raw = await service.issueForNewSession('u1', {});
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(20);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('rotate() rejects an unknown token', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.rotate('nope', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotate() detects reuse of a revoked token and revokes the family', async () => {
    repo.findOne.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      familyId: 'fam1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    } as RefreshToken);

    await expect(service.rotate('raw', {})).rejects.toThrow(
      /reuse detected/i,
    );
    // family revocation issued
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'fam1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('rotate() rotates a valid token: revokes the old, mints a new one', async () => {
    const current = {
      id: 't1',
      userId: 'u1',
      familyId: 'fam1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as RefreshToken;
    repo.findOne.mockResolvedValue(current);

    const res = await service.rotate('raw', {});

    expect(current.revokedAt).toBeInstanceOf(Date); // old token revoked
    expect(res.userId).toBe('u1');
    expect(typeof res.rawToken).toBe('string');
    // one save for revoking current, one for the new token
    expect(repo.save).toHaveBeenCalledTimes(2);
  });
});
