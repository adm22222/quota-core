import type { Outcome } from '../../generated/prisma/client.ts';
import { formatMonth, getMonthStart } from '../../helpers/month.ts';
import { ConflictError, NotFoundError } from '../../shared/errors.ts';
import { runLimited } from '../../shared/run-limited.ts';
import { createLimitRepository } from './limits.repository.ts';
import { createRequestRepository } from './request.repository.ts';
import type { DecisionRepository } from './decision.repository.ts';
import { createFingerprint } from './fingerprint.ts';
import type { CreateConsume } from './consume.schema.ts';
import { RuleEvaluator } from '../rules/rule-evaluator.ts';
import type { RuleViolation } from '../rules/rule.types.ts';
import {
  isConsumeSnapshot,
  isRuleViolation,
  type ConsumeSnapshot,
  type ConsumeViolation,
  type PlanWithLimits,
} from './consumption.types.ts';
import type {
  RepositoryFactory,
  TransactionManager,
} from '../../shared/transaction-manager.ts';
const ACCOUNT_CONCURRENCY = 3;
const GLOBAL_TRANSACTION_CONCURRENCY = 8;
const MAX_WAITING_PER_ACCOUNT = 500;

const toStatus = (
  plan: PlanWithLimits,
  consumed: number,
): ConsumeSnapshot['account'] => ({
  planId: plan.id,
  planName: plan.name,
  monthlyAllowance: plan.monthlyAllowance,
  maxPerRequest: plan.maxPerRequest,
  consumed,
  remaining: Math.max(0, plan.monthlyAllowance - consumed),
});

const toViolation = (violation: RuleViolation): ConsumeViolation => ({
  level: violation.level,
  rule: violation.rule,
  limit: violation.limit,
  attempted: violation.actual,
  ...(violation.remaining !== undefined
    ? { remaining: violation.remaining }
    : {}),
});

const fromStored = (row: {
  limitsSnapshot?: ConsumeSnapshot | null;
}): ConsumeSnapshot => {
  if (!isConsumeSnapshot(row.limitsSnapshot)) {
    throw new Error('Stored consumption request has no limits snapshot');
  }
  return row.limitsSnapshot;
};

const fromStoredViolations = (
  violations: RuleViolation[] | null | undefined,
) => {
  if (!violations) return [];
  if (!violations.every(isRuleViolation)) {
    throw new Error('Stored consumption request has invalid violations');
  }
  return violations;
};

const getStoredPrimaryViolation = (row: {
  violations?: RuleViolation[] | null;
  rejectedRule: RuleViolation['rule'] | null | undefined;
  rejectedLevel: RuleViolation['level'] | null | undefined;
  units: number;
}): RuleViolation | null => {
  if (!row.rejectedRule || !row.rejectedLevel) return null;
  const stored = fromStoredViolations(row.violations);
  return (
    stored[0] ?? {
      level: row.rejectedLevel,
      rule: row.rejectedRule,
      limit: 0,
      actual: row.units,
      remaining: 0,
    }
  );
};

export type LimitRepository = ReturnType<typeof createLimitRepository>;
export type RequestRepository = ReturnType<typeof createRequestRepository>;

export const createConsumeService = (deps: {
  limitRepositoryFactory: RepositoryFactory<LimitRepository>;
  requestRepositoryFactory: RepositoryFactory<RequestRepository>;
  decisionRepositoryFactory: RepositoryFactory<DecisionRepository>;
  transactionManager: TransactionManager;
}) => {
  const evaluator = new RuleEvaluator();

  return {
    async consume(accountId: string, input: CreateConsume) {
      const result = await runLimited(
        accountId,
        ACCOUNT_CONCURRENCY,
        async () => {
          const transactionResult = await runLimited(
            '__global_transactions__',
            GLOBAL_TRANSACTION_CONCURRENCY,
            () =>
              deps.transactionManager.run(async (tx) => {
                const month = getMonthStart(
                  new Date().toISOString().slice(0, 7),
                );
                const limitsRepository = deps.limitRepositoryFactory(tx);
                const requestRepository = deps.requestRepositoryFactory(tx);
                const decisions = deps.decisionRepositoryFactory(tx);

                const user = await limitsRepository.findUserId(
                  accountId,
                  input.userRef,
                );

                if (!user) throw new NotFoundError('User not found');

                const fingerprint = createFingerprint(
                  input.userRef,
                  input.units,
                );
                const claimed = await requestRepository.claim({
                  accountId,
                  userId: user.id,
                  requestId: input.requestId,
                  units: input.units,
                  payloadFingerprint: fingerprint,
                  month,
                });

                if (!claimed) {
                  const existing = await requestRepository.findByRequestId(
                    accountId,
                    input.requestId,
                  );
                  if (!existing)
                    throw new NotFoundError(
                      'Consumption request disappeared after conflict',
                    );
                  if (existing.payloadFingerprint !== fingerprint) {
                    throw new ConflictError(
                      'requestId was already used with a different payload',
                      {
                        code: 'request_id_reused_with_different_payload',
                      },
                    );
                  }
                  const snapshot = fromStored(existing);
                  const storedViolations = fromStoredViolations(
                    existing.violations,
                  );
                  const primaryViolation = getStoredPrimaryViolation(existing);
                  return {
                    requestId: input.requestId,
                    userRef: input.userRef,
                    units: existing.units,
                    accepted: existing.outcome === 'ACCEPTED',
                    replayed: true,
                    reason: primaryViolation
                      ? toViolation(primaryViolation)
                      : null,
                    violations: storedViolations.map(toViolation),
                    month: formatMonth(existing.month),
                    processedAt: existing.processedAt,
                    ...snapshot,
                  };
                }

                let accountConsumed = await decisions.lockAccountUsage(
                  accountId,
                  month,
                );
                if (accountConsumed === null) {
                  await decisions.ensureAccountUsage(accountId, month);
                  accountConsumed = await decisions.lockAccountUsage(
                    accountId,
                    month,
                  );
                  if (accountConsumed === null)
                    throw new Error('account usage row missing after ensure');
                }

                const ctx = await decisions.readContext(user.id, month);

                const decision = evaluator.evaluate({
                  units: input.units,
                  account: {
                    limits: ctx.accountPlan,
                    consumed: accountConsumed,
                  },
                  user: { limits: ctx.userPlan, consumed: ctx.userConsumed },
                });

                const delta = decision.allowed ? input.units : 0;
                const snapshot: ConsumeSnapshot = {
                  account: toStatus(ctx.accountPlan, accountConsumed + delta),
                  user: toStatus(ctx.userPlan, ctx.userConsumed + delta),
                };
                const violations = decision.violations.map(toViolation);

                const processedAt = decision.allowed
                  ? (
                      await decisions.recordAccepted({
                        requestRowId: claimed.id,
                        accountId,
                        userId: user.id,
                        month,
                        units: input.units,
                        snapshot,
                      })
                    ).processedAt
                  : (
                      await requestRepository.finalize(claimed.id, {
                        outcome: 'REJECTED' satisfies Outcome,
                        rejectedRule: decision.primary?.rule ?? null,
                        rejectedLevel: decision.primary?.level ?? null,
                        violations: decision.violations,
                        limitsSnapshot: snapshot,
                      })
                    ).processedAt;

                return {
                  requestId: input.requestId,
                  userRef: input.userRef,
                  units: input.units,
                  accepted: decision.allowed,
                  replayed: false,
                  reason: decision.primary
                    ? toViolation(decision.primary)
                    : null,
                  violations,
                  month: formatMonth(month),
                  processedAt,
                  ...snapshot,
                };
              }),
          );
          return transactionResult;
        },
        MAX_WAITING_PER_ACCOUNT,
      );
      return result;
    },
  };
};

export type ConsumeService = ReturnType<typeof createConsumeService>;
