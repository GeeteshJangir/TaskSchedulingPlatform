import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end happy path against a real database (Neon locally; the Postgres
 * service in CI). Boots the whole AppModule and walks the core flow:
 *   signup → me → workspace → project → task → comment → list.
 * Run with: npm run test:e2e   (requires a reachable Postgres + migrations run)
 */
describe('Platform (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const stamp = Date.now();
  const email = `e2e${stamp}@example.test`;
  let token: string;
  let workspaceId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    // Let fire-and-forget event listeners (activity / notifications) drain
    // before tearing down the DB connection.
    await new Promise((resolve) => setTimeout(resolve, 750));
    await app?.close();
  });

  it('liveness is ok', () =>
    request(http).get('/api/health/live').expect(200).expect({ status: 'ok' }));

  it('rejects a protected route without a token (401)', () =>
    request(http).get('/api/users/me').expect(401));

  it('signs up and returns tokens', async () => {
    const res = await request(http)
      .post('/api/auth/signup')
      .send({ email, name: 'E2E User', password: 'S3curePass!' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    token = res.body.accessToken;
  });

  it('returns the current user', () =>
    request(http)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => expect(res.body.email).toBe(email)));

  it('creates a workspace (owner = ADMIN)', async () => {
    const res = await request(http)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `E2E Workspace ${stamp}` })
      .expect(201);
    workspaceId = res.body.id;
    expect(res.body.slug).toBeDefined();
  });

  it('creates a project', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Board' })
      .expect(201);
    projectId = res.body.id;
  });

  it('creates a task (defaults to TODO)', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'E2E task', priority: 'HIGH' })
      .expect(201);
    taskId = res.body.id;
    expect(res.body.status).toBe('TODO');
    expect(res.body.priority).toBe('HIGH');
  });

  it('comments on the task', () =>
    request(http)
      .post(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'first comment' })
      .expect(201));

  it('lists tasks with keyset pagination', () =>
    request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.meta).toHaveProperty('hasMore');
      }));
});
