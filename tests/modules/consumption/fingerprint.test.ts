import { describe, expect, it } from 'vitest';
import { createFingerprint } from '../../../src/modules/consumption/fingerprint.ts';

describe('fingerprint test', () => {
  it('should retern same when same data', () => {
    expect(createFingerprint('Adam', 200)).toBe(createFingerprint('Adam', 200));
  });
  it('should retern diff when diff data', () => {
    expect(createFingerprint('Adam', 200)).not.toBe(
      createFingerprint('Adam', 300),
    );
  });
});
