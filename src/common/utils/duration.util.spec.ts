import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
    ['7d', 604_800_000],
    ['500ms', 500],
    ['1000', 1000],
  ])('parses %s -> %d ms', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it('throws on garbage input', () => {
    expect(() => parseDurationMs('soon')).toThrow();
  });
});
