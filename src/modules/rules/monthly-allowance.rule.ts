import type { Rule, RuleContext, RuleViolation } from './rule.types.ts';

export class MonthlyAllowanceRule implements Rule {
  readonly type: 'MONTHLY_ALLOWANCE';

  constructor() {
    this.type = 'MONTHLY_ALLOWANCE';
  }

  evaluate(context: RuleContext): RuleViolation | null {
    const { requested, limits, level } = context;
    const remainingAllowance = Math.max(
      0,
      limits.monthlyAllowance - context.monthlyConsumed,
    );
    if (requested <= remainingAllowance) {
      return null;
    }
    return {
      level,
      rule: this.type,
      limit: limits.monthlyAllowance,
      actual: requested,
      remaining: remainingAllowance,
    };
  }
}
