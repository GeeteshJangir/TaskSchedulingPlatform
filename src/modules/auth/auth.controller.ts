import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignupDto } from './dto/signup.dto';
import { SessionContext } from './types';

@ApiTags('auth')
// Tighter limit on auth endpoints (anti brute-force) than the global default.
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.auth.signup(dto, this.context(req));
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.auth.login(dto, this.context(req));
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken, this.context(req));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  private context(req: Request): SessionContext {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    };
  }
}
