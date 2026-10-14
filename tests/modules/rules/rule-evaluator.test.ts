import { describe, expect, it } from 'vitest';
import { RuleEvaluator } from '../../../src/modules/rules/rule-evaluator.ts';
import type { Rule } from '../../../src/modules/rules/rule.types.ts';

const evaluator = new RuleEvaluator();

const account = (consumed = 0) => ({
  limits: { monthlyAllowance: 10_000, maxPerRequest: 100 },
  consumed,
});
const user = (consumed = 0) => ({
  limits: { monthlyAllowance: 1_000, maxPerRequest: 20 },
  consumed,
});

describe('RuleEvaluator — examples from the brief', () => {
  it('rejects 25 units on the user per-request limit even though both allowances have room', () => {
    const d = evaluator.evaluate({
      units: 25,
      account: account(),
      user: user(),
    });
    expect(d.allowed).toBe(false);
    expect(d.primary).toEqual({
      level: 'USER',
      rule: 'MAX_PER_REQUEST',
      limit: 20,
      actual: 25,
    });
    expect(d.violations).toHaveLength(1);
    expect(d.remaining).toEqual({ ACCOUNT: 10_000, USER: 1_000 }); // nothing consumed
  });

  it('accepts 10 units when both have room and reports remaining after the decision', () => {
    const d = evaluator.evaluate({
      units: 10,
      account: account(),
      user: user(),
    });
    expect(d.allowed).toBe(true);
    expect(d.primary).toBeNull();
    expect(d.violations).toHaveLength(0);
    expect(d.remaining).toEqual({ ACCOUNT: 9_990, USER: 990 });
  });

  it('rejects 10 units when the account has only 5 left, although the user has plenty', () => {
    const d = evaluator.evaluate({
      units: 10,
      account: account(9_995),
      user: user(),
    });
    expect(d.allowed).toBe(false);
    expect(d.primary).toEqual({
      level: 'ACCOUNT',
      rule: 'MONTHLY_ALLOWANCE',
      limit: 10_000,
      actual: 10,
      remaining: 5,
    });
    expect(d.remaining).toEqual({ ACCOUNT: 5, USER: 1_000 });
  });
});

describe('RuleEvaluator — boundaries', () => {
  it('accepts exactly the per-request cap and exactly the remaining units', () => {
    expect(
      evaluator.evaluate({ units: 20, account: account(), user: user() })
        .allowed,
    ).toBe(true);
    expect(
      evaluator.evaluate({ units: 20, account: account(), user: user(980) })
        .allowed,
    ).toBe(true);
  });
  it('rejects one unit over the remaining allowance', () => {
    expect(
      evaluator.evaluate({ units: 20, account: account(), user: user(981) })
        .allowed,
    ).toBe(false);
  });
  it('reports 0 remaining and rejects when an allowance was reduced below usage', () => {
    const reduced = {
      limits: { monthlyAllowance: 100, maxPerRequest: 20 },
      consumed: 120,
    };
    const d = evaluator.evaluate({
      units: 1,
      account: account(),
      user: reduced,
    });
    expect(d.allowed).toBe(false);
    expect(d.primary?.level).toBe('USER');
    expect(d.remaining.USER).toBe(0);
  });
});

describe('RuleEvaluator — no short-circuit and fixed order', () => {
  it('returns all four violations in the order acct/user per-request, acct/user monthly', () => {
    const d = evaluator.evaluate({
      units: 500,
      account: account(9_950),
      user: user(990),
    });
    expect(d.violations.map((v) => `${v.level}:${v.rule}`)).toEqual([
      'ACCOUNT:MAX_PER_REQUEST',
      'USER:MAX_PER_REQUEST',
      'ACCOUNT:MONTHLY_ALLOWANCE',
      'USER:MONTHLY_ALLOWANCE',
    ]);
    expect(d.primary).toEqual(d.violations[0]);
  });
  it('prefers a per-request violation over a monthly one', () => {
    const d = evaluator.evaluate({
      units: 25,
      account: account(),
      user: user(990),
    });
    expect(d.primary?.rule).toBe('MAX_PER_REQUEST');
    expect(d.violations).toHaveLength(2);
  });
  it('prefers the account over the user when both fail the same rule', () => {
    const d = evaluator.evaluate({
      units: 10,
      account: account(9_999),
      user: user(999),
    });
    expect(d.primary?.level).toBe('ACCOUNT');
    expect(d.violations.map((v) => v.level)).toEqual(['ACCOUNT', 'USER']);
  });
});

describe('RuleEvaluator — safety and extension', () => {
  it('throws on invalid units (programmer error; the API validates earlier)', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(() =>
        evaluator.evaluate({ units: bad, account: account(), user: user() }),
      ).toThrow(RangeError);
    }
  });
  it('does not mutate its input and is deterministic', () => {
    const input = { units: 10, account: account(5), user: user(5) };
    const copy = JSON.parse(JSON.stringify(input));
    expect(evaluator.evaluate(input)).toEqual(evaluator.evaluate(input));
    expect(input).toEqual(copy);
  });
  it('runs extra rules after the defaults (FR-19 extension point)', () => {
    const noBigOnes: Rule = {
      type: 'MAX_PER_REQUEST',
      evaluate: ({ requested, level }) =>
        requested > 5
          ? { level, rule: 'MAX_PER_REQUEST', limit: 5, actual: requested }
          : null,
    };
    const custom = new RuleEvaluator([...[], noBigOnes]);
    const d = custom.evaluate({ units: 6, account: account(), user: user() });
    expect(d.violations).toHaveLength(2); // once per level
  });
  it('requires at least one rule', () => {
    expect(() => new RuleEvaluator([])).toThrow();
  });
});
