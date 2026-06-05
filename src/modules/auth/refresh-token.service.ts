import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { parseDurationMs } from '../../common/utils/duration.util';
import { RefreshToken } from './entities/refresh-token.entity';
import { SessionContext } from './types';

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.ttlMs = parseDurationMs(config.get<string>('jwt.refreshTtl') ?? '7d');
  }

  /** Starts a fresh session (new family) and returns the raw refresh token. */
  issueForNewSession(userId: string, ctx: SessionContext = {}): Promise<string> {
    return this.createToken(userId, randomUUID(), ctx);
  }

  /**
   * Rotates a refresh token:
   *  - unknown token            -> 401
   *  - already-revoked token    -> reuse detected: revoke the whole family, 401
   *  - expired token            -> 401
   *  - valid token              -> revoke it, mint the next in the same family
   */
  async rotate(
    rawToken: string,
    ctx: SessionContext = {},
  ): Promise<{ userId: string; rawToken: string }> {
    const current = await this.tokens.findOne({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!current) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (current.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    current.revokedAt = new Date();
    await this.tokens.save(current);

    const nextRaw = await this.createToken(current.userId, current.familyId, ctx);
    return { userId: current.userId, rawToken: nextRaw };
  }

  /** Revokes a single token (logout). No-op if already gone. */
  async revoke(rawToken: string): Promise<void> {
    await this.tokens.update(
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async createToken(
    userId: string,
    familyId: string,
    ctx: SessionContext,
  ): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const token = this.tokens.create({
      userId,
      familyId,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + this.ttlMs),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
    });
    await this.tokens.save(token);
    return raw;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
