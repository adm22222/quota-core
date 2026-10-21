import type {
  PlanLimits,
  RuleLevel,
  RuleType,
  RuleViolation,
} from '../../shared/types.ts';

export type { PlanLimits, RuleLevel, RuleType } from '../../shared/types.ts';

export interface RuleContext {
  level: RuleLevel;
  limits: PlanLimits;
  monthlyConsumed: number;
  requested: number;
}

export type { RuleViolation } from '../../shared/types.ts';

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
