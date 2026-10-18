import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decodeCursor, encodeCursor } from '../../src/helpers/cursor.ts';

describe('cursor helper', () => {
  it('round-trips any schema-defined cursor value', () => {
    const schema = z.object({ id: z.string(), offset: z.number() });
    const value = { id: 'abc', offset: 10 };

    expect(decodeCursor(encodeCursor(value), schema)).toEqual(value);
  });

  it('rejects malformed or schema-invalid cursors', () => {
    expect(() => decodeCursor('not-a-cursor', z.string())).toThrowError(
      'Invalid cursor',
    );
    expect(() => decodeCursor(encodeCursor(42), z.string())).toThrowError(
      'Invalid cursor',
    );
  });
});
