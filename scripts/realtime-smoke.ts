/**
 * Live realtime smoke test: User B connects a Socket.IO client (authenticated),
 * User A assigns B a task over REST, and B should receive the notification push.
 *   npx ts-node scripts/realtime-smoke.ts   (server must be running)
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3000/api';

async function post(path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const a = await post('/auth/signup', {
    email: `rtA${stamp}@t.test`,
    name: 'RT A',
    password: 'S3curePass!',
  });
  const ws = await post('/workspaces', { name: `RT WS ${stamp}` }, a.accessToken);
  const proj = await post(
    `/workspaces/${ws.id}/projects`,
    { name: 'Board' },
    a.accessToken,
  );
  const bEmail = `rtB${stamp}@t.test`;
  const inv = await post(
    `/workspaces/${ws.id}/invitations`,
    { email: bEmail, role: 'MEMBER' },
    a.accessToken,
  );
  const b = await post('/auth/signup', {
    email: bEmail,
    name: 'RT B',
    password: 'S3curePass!',
  });
  await post('/invitations/accept', { token: inv.token }, b.accessToken);

  const socket = io('http://localhost:3000/ws/notifications', {
    auth: { token: b.accessToken },
    transports: ['websocket'],
  });

  const received = new Promise<any>((resolve, reject) => {
    socket.on('notification', resolve);
    socket.on('unauthorized', (m) =>
      reject(new Error('unauthorized: ' + JSON.stringify(m))),
    );
    setTimeout(() => reject(new Error('timeout: no push received')), 15000);
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (e) => reject(e));
  });
  console.log('B socket connected:', socket.id);

  await post(
    `/workspaces/${ws.id}/projects/${proj.id}/tasks`,
    { title: 'Realtime task', assigneeId: b.user.id },
    a.accessToken,
  );
  console.log('A assigned a task to B (REST)');

  const notif = await received;
  console.log(`REALTIME PUSH RECEIVED -> ${notif.type}: "${notif.title}"`);
  socket.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
