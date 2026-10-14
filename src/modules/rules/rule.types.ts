export type RuleLevel = 'ACCOUNT' | 'USER';

export type RuleType = 'MAX_PER_REQUEST' | 'MONTHLY_ALLOWANCE';

export interface PlanLimits {
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface RuleContext {
  level: RuleLevel;
  limits: PlanLimits;
  monthlyConsumed: number;
  requested: number;
}

export interface RuleViolation {
  level: RuleLevel;
  rule: RuleType;
  limit: number;
  actual: number;
  remaining?: number;
}

export interface Decision {
  allowed: boolean;
  violations: RuleViolation[];
  primary: RuleViolation | null;
  remaining: Record<RuleLevel, number>;
}

export interface Rule {
  readonly type: RuleType;

  evaluate(context: RuleContext): RuleViolation | null;
}
