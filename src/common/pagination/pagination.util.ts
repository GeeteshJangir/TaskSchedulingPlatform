/**
 * Keyset (cursor) pagination helpers, shared by all list endpoints.
 * A cursor encodes the sort key of the last row on a page — here (createdAt,id),
 * which is stable under inserts and avoids deep-OFFSET scans.
 */
export interface PageMeta {
  limit: number;
  count: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url')
      .toString('utf8')
      .split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Given `limit + 1` rows fetched from the DB, trims to `limit`, computes
 * hasMore, and derives the next cursor from the last returned row.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => string,
): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? toCursor(data[data.length - 1]) : null;
  return { data, meta: { limit, count: data.length, hasMore, nextCursor } };
}
