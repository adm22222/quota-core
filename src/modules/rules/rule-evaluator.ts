import { MaxPerRequestRule } from './max-per-request.rule.ts';
import { MonthlyAllowanceRule } from './monthly-allowance.rule.ts';
import type {
  Decision,
  PlanLimits,
  Rule,
  RuleLevel,
  RuleViolation,
} from './rule.types.ts';

export interface LevelState {
  readonly limits: PlanLimits;
  readonly consumed: number;
}

export interface EvaluationInput {
  readonly units: number;
  readonly account: LevelState;
  readonly user: LevelState;
}

export const DEFAULT_RULES: readonly Rule[] = [
  new MaxPerRequestRule(),
  new MonthlyAllowanceRule(),
];

const LEVEL_ORDER: readonly RuleLevel[] = ['ACCOUNT', 'USER'];

export class RuleEvaluator {
  private readonly rules: readonly Rule[];

  constructor(rules: readonly Rule[] = DEFAULT_RULES) {
    if (rules.length === 0) {
      throw new Error('RuleEvaluator needs at least one rule');
    }

    this.rules = [...rules];
  }

  evaluate(input: EvaluationInput): Decision {
    const { units, account, user } = input;

    if (!Number.isSafeInteger(units) || units < 1) {
      throw new RangeError(
        `units must be a positive integer, received ${units}`,
      );
    }
    const states: Record<RuleLevel, LevelState> = {
      ACCOUNT: account,
      USER: user,
    };

    const violations: RuleViolation[] = [];
    for (const rule of this.rules) {
      for (const level of LEVEL_ORDER) {
        const { limits, consumed } = states[level];
        const violation = rule.evaluate({
          level,
          limits,
          monthlyConsumed: consumed,
          requested: units,
        });
        if (violation) violations.push(violation);
      }
    }

    const allowed = violations.length === 0;
    const accountLeft = Math.max(
      0,
      account.limits.monthlyAllowance - account.consumed,
    );
    const userLeft = Math.max(0, user.limits.monthlyAllowance - user.consumed);

    return {
      allowed,
      violations,
      primary: violations[0] ?? null,
      remaining: allowed
        ? {
            ACCOUNT: Math.max(0, accountLeft - units),
            USER: Math.max(0, userLeft - units),
          }
        : { ACCOUNT: accountLeft, USER: userLeft },
    };
  }
}
