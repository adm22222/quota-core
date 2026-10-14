import { describe, expect, it } from 'vitest';
import { MaxPerRequestRule } from '../../../src/modules/rules/max-per-request.rule.ts';
import type { RuleContext } from '../../../src/modules/rules/rule.types.ts';

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
