import type { Rule, RuleContext, RuleViolation } from './rule.types.ts';

export class MaxPerRequestRule implements Rule {
  readonly type: 'MAX_PER_REQUEST';

  constructor() {
    this.type = 'MAX_PER_REQUEST';
  }

  evaluate(context: RuleContext): RuleViolation | null {
    const { requested, limits, level } = context;
    if (requested <= limits.maxPerRequest) {
      return null;
    }
    return {
      level,
      rule: this.type,
      limit: limits.maxPerRequest,
      actual: requested,
    };
  }
}
