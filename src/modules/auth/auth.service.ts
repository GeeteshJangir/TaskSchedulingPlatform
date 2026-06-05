import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtPayload, SessionContext } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto, ctx: SessionContext): Promise<AuthResponseDto> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    return this.issueTokens(user, ctx);
  }

  async login(dto: LoginDto, ctx: SessionContext): Promise<AuthResponseDto> {
    const user = await this.users.findByEmailWithSecret(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user, ctx);
  }

  async refresh(
    rawRefreshToken: string,
    ctx: SessionContext,
  ): Promise<AuthResponseDto> {
    const { userId, rawToken } = await this.refreshTokens.rotate(
      rawRefreshToken,
      ctx,
    );
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    const accessToken = await this.signAccessToken(user);
    return this.toResponse(user, accessToken, rawToken);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawRefreshToken);
  }

  private async issueTokens(
    user: User,
    ctx: SessionContext,
  ): Promise<AuthResponseDto> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.refreshTokens.issueForNewSession(
      user.id,
      ctx,
    );
    return this.toResponse(user, accessToken, refreshToken);
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  private toResponse(
    user: User,
    accessToken: string,
    refreshToken: string,
  ): AuthResponseDto {
    return {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
