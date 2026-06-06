import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  it('applies dev defaults for a minimal config', () => {
    const { error, value } = envValidationSchema.validate({
      DB_USERNAME: 'u',
      DB_PASSWORD: 'p',
      DB_NAME: 'db',
    });
    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.JWT_ACCESS_SECRET).toBe('dev-access-secret-change-me');
  });

  it('rejects the dev-default JWT secret in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
      JWT_REFRESH_SECRET: 'r'.repeat(40),
    });
    expect(error).toBeDefined();
  });

  it('rejects a too-short production secret', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'r'.repeat(40),
    });
    expect(error).toBeDefined();
  });

  it('accepts strong, non-default secrets in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
    });
    expect(error).toBeUndefined();
  });
});
