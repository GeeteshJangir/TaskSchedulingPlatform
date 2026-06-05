const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a short duration string ('15m', '7d', '30s', '12h', '500ms') into
 * milliseconds. A bare number is treated as milliseconds. Used for refresh
 * token TTLs.
 */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) {
    const asNumber = Number(input);
    if (!Number.isNaN(asNumber)) return asNumber;
    throw new Error(`Invalid duration: "${input}"`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  return unit === 'ms' ? value : value * UNIT_MS[unit];
}
