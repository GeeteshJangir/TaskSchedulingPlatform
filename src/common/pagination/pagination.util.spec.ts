import { buildPage, decodeCursor, encodeCursor } from './pagination.util';

describe('pagination.util', () => {
  it('trims to limit and flags hasMore when an extra row is present', () => {
    const page = buildPage([1, 2, 3], 2, (n) => String(n));
    expect(page.data).toEqual([1, 2]);
    expect(page.meta.hasMore).toBe(true);
    expect(page.meta.count).toBe(2);
    expect(page.meta.nextCursor).toBe('2');
  });

  it('reports no more pages when rows do not exceed the limit', () => {
    const page = buildPage([1], 2, (n) => String(n));
    expect(page.meta.hasMore).toBe(false);
    expect(page.meta.nextCursor).toBeNull();
  });

  it('round-trips a cursor', () => {
    const createdAt = new Date('2026-06-05T00:00:00.000Z');
    const cursor = encodeCursor(createdAt, 'abc-123');
    expect(decodeCursor(cursor)).toEqual({
      createdAt: '2026-06-05T00:00:00.000Z',
      id: 'abc-123',
    });
  });

  it('returns null for a malformed cursor', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
  });
});
