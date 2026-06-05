import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes with the 'jwt' Passport strategy (registered by AuthModule).
 * Lives in common so any module can guard routes without importing AuthModule.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
