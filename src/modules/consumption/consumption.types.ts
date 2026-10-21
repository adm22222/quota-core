import type {
  ConsumeSnapshot,
  LevelStatus,
  PlanLimits,
  PlanWithLimits,
  RuleLevel,
  RuleType,
  RuleViolation,
} from '../../shared/types.ts';

export type {
  ConsumeSnapshot,
  LevelStatus,
  PlanLimits,
  PlanWithLimits,
  RuleLevel,
  RuleType,
} from '../../shared/types.ts';

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
): value is RuleViolation => {
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
