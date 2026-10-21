export type PlanScope = 'ACCOUNT' | 'USER';

export type RuleLevel = PlanScope;

export type RuleType = 'MAX_PER_REQUEST' | 'MONTHLY_ALLOWANCE';

export interface PlanLimits {
  monthlyAllowance: number;
  maxPerRequest: number;
}

export type PlanWithLimits = { id: string; name: string } & PlanLimits;

export interface LevelStatus extends PlanLimits {
  planId: string;
  planName: string;
  consumed: number;
  remaining: number;
}

export interface ConsumeSnapshot {
  account: LevelStatus;
  user: LevelStatus;
}

export interface RuleViolation {
  level: RuleLevel;
  rule: RuleType;
  limit: number;
  actual: number;
  remaining?: number;
}
