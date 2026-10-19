import type { PlanLimits, RuleLevel, RuleType } from '../rules/rule.types.ts';

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

export interface ConsumeViolation {
  level: RuleLevel;
  rule: RuleType;
  limit: number;
  attempted: number;
  remaining?: number;
}

export const isConsumeSnapshot = (value: unknown): value is ConsumeSnapshot => {
  if (!isRecord(value)) return false;
  return isLevelStatus(value.account) && isLevelStatus(value.user);
};

export const isRuleViolation = (
  value: unknown,
): value is {
  level: RuleLevel;
  rule: RuleType;
  limit: number;
  actual: number;
  remaining?: number;
} => {
  if (!isRecord(value)) return false;

  return (
    isRuleLevel(value.level) &&
    isRuleType(value.rule) &&
    isNumber(value.limit) &&
    isNumber(value.actual) &&
    (value.remaining === undefined || isNumber(value.remaining))
  );
};

const isLevelStatus = (value: unknown): value is LevelStatus => {
  if (!isRecord(value)) return false;

  return (
    isString(value.planId) &&
    isString(value.planName) &&
    isNumber(value.monthlyAllowance) &&
    isNumber(value.maxPerRequest) &&
    isNumber(value.consumed) &&
    isNumber(value.remaining)
  );
};

const isRuleLevel = (value: unknown): value is RuleLevel =>
  value === 'ACCOUNT' || value === 'USER';

const isRuleType = (value: unknown): value is RuleType =>
  value === 'MAX_PER_REQUEST' || value === 'MONTHLY_ALLOWANCE';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number => typeof value === 'number';

const isString = (value: unknown): value is string => typeof value === 'string';
