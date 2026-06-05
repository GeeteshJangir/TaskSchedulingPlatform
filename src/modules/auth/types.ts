/** Request metadata captured with each refresh-token session. */
export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

/** Access-token JWT payload. */
export interface JwtPayload {
  sub: string;
  email: string;
}
