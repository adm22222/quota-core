import { describe, expect, it } from 'vitest';
import { MaxPerRequestRule } from '../../../src/modules/rules/max-per-request.rule.ts';
import type { RuleContext } from '../../../src/modules/rules/rule.types.ts';
import { MonthlyAllowanceRule } from '../../../src/modules/rules/monthly-allowance.rule.ts';

const limits = { monthlyAllowance: 100, maxPerRequest: 20 };

describe('MaxPerRequestRule', () => {
  const rule = new MaxPerRequestRule();
  it('should return null if requested is less than maxPerRequest', () => {
    const context: RuleContext = {
      level: 'USER',
      limits,
      monthlyConsumed: 0,
      requested: 10,
    };
    const result = rule.evaluate(context);
    expect(result).toBeNull();
  });
  it('should return an error if requested is greater than maxPerRequest', () => {
    const context: RuleContext = {
      level: 'USER',
      limits,
      monthlyConsumed: 0,
      requested: 25,
    };
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result).toEqual({
      level: 'USER',
      rule: 'MAX_PER_REQUEST',
      limit: limits.maxPerRequest,
      actual: context.requested,
    });
  });
  it('ignores consumed units', () => {
    expect(
      rule.evaluate({
        requested: 20,
        level: 'ACCOUNT',
        limits,
        monthlyConsumed: 1_000,
      }),
    ).toBeNull();
  });
});

describe('MonthlyAllowanceRule', () => {
  const rule = new MonthlyAllowanceRule();
  it('accepts requests that do not exceed the monthly allowance', () => {
    const context: RuleContext = {
      level: 'USER',
      limits,
      monthlyConsumed: 50,
      requested: 30,
    };
    expect(rule.evaluate(context)).toBeNull();
  });
  it('rejects requests that exceed the monthly allowance', () => {
    const context: RuleContext = {
      level: 'USER',
      limits,
      monthlyConsumed: 90,
      requested: 20,
    };
    expect(rule.evaluate(context)).toEqual({
      level: 'USER',
      rule: 'MONTHLY_ALLOWANCE',
      actual: context.requested,
      limit: limits.monthlyAllowance,
      remaining: 10,
    });
  });
  it('treats an allowance reduced below usage as 0 remaining', () => {
    const v = rule.evaluate({
      requested: 1,
      level: 'ACCOUNT',
      limits,
      monthlyConsumed: 120,
    });
    expect(v?.remaining).toBe(0);
    expect(v?.rule).toBe('MONTHLY_ALLOWANCE');
  });
});
