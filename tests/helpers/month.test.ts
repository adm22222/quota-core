import { describe, expect, it } from 'vitest';
import { formatMonth, rejectFutureMonths } from '../../src/helpers/month.ts';

describe('formatMonth', () => {
  it('should format a valid date to YYYY-MM in UTC', () => {
    expect(formatMonth(new Date('2023-05-15T12:00:00.000Z'))).toBe('2023-05');
  });

  it('should keep the last second of the month in that month', () => {
    const lastSecond = new Date('2026-01-31T23:59:59.000Z');

    expect(formatMonth(lastSecond)).toBe('2026-01');
  });

  it('should return the next month at 00:00:00 UTC', () => {
    const nextMonth = new Date('2026-02-01T00:00:00.000Z');

    expect(formatMonth(nextMonth)).toBe('2026-02');
  });

  it('should throw for an invalid date', () => {
    expect(() => formatMonth(new Date('invalid'))).toThrowError('Invalid date');
  });
});

describe('rejectFutureMonths', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');

  it('should allow past months', () => {
    expect(() => rejectFutureMonths('2026-05', now)).not.toThrow();
  });

  it('should allow the current month', () => {
    expect(() => rejectFutureMonths('2026-10', now)).not.toThrow();
  });

  it('should reject a future month in the same year', () => {
    expect(() => rejectFutureMonths('2026-11', now)).toThrowError(
      'Future months are not allowed',
    );
  });

  it('should reject a future year', () => {
    expect(() => rejectFutureMonths('2027-01', now)).toThrowError(
      'Future months are not allowed',
    );
  });

  it('should reject an invalid reference date', () => {
    expect(() =>
      rejectFutureMonths('2026-05', new Date('invalid')),
    ).toThrowError('Invalid reference date');
  });
});
