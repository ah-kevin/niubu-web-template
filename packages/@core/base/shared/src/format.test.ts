import { describe, expect, it } from 'vitest';
import { businessDateAt } from '@niubu/core-shared';
describe('business dates', () => {
  it('derives date from an unambiguous instant in the explicit business timezone', () => {
    expect(businessDateAt('2026-10-10T23:30:00Z', 'Asia/Shanghai')).toBe('2026-10-11');
    expect(businessDateAt('2026-10-10T23:30:00Z', 'America/New_York')).toBe('2026-10-10');
    expect(() => businessDateAt('2026-10-11', 'UTC')).toThrow();
    expect(() => businessDateAt('bad', 'UTC')).toThrow();
    expect(() => businessDateAt('2026-02-31T00:00:00Z', 'UTC')).toThrow();
    expect(() => businessDateAt('2026-10-11T24:00:00Z', 'UTC')).toThrow();
    expect(() => businessDateAt('2026-10-10T23:30:00Z', 'bad-zone')).toThrow();
  });
});
