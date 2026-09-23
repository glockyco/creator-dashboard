import { describe, expect, it } from 'vitest';
import { Identity, identities } from './identities';

describe('identities', () => {
  it('contains the two approved creator identities', () => {
    expect(identities).toEqual(['glockyco', 'WoW_Much']);
  });

  it('rejects unknown identities', () => {
    expect(() => Identity.parse('someone_else')).toThrow();
  });
});
