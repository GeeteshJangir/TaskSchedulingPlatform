import { slugify } from './slugify.util';

describe('slugify', () => {
  it.each([
    ['Acme Corp', 'acme-corp'],
    ['  Hello   World!  ', 'hello-world'],
    ['Über Café 2026', 'ber-caf-2026'],
    ['___', 'workspace'],
  ])('slugifies %j -> %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
