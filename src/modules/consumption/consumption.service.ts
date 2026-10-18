import type { PrismaClient, Outcome } from '../../generated/prisma/client.ts';
import { formatMonth, getMonthStart } from '../../helpers/month.ts';
import { ConflictError, NotFoundError } from '../../shared/errors.ts';
import { createLimitRepository } from './limits.repository.ts';
import { createRequestRepository } from './request.repository.ts';
import { createUsageRepository } from '../usage/usage.repository.ts';
import { createFingerprint } from './fingerprint.ts';
import type { CreateConsume } from './consume.schema.ts';
import { RuleEvaluator } from '../rules/rule-evaluator.ts';
import type { PlanLimits, RuleLevel, RuleType } from '../rules/rule.types.ts';

type LevelStatus = PlanLimits & {
  planId: string;
  planName: string;
  consumed: number;
  remaining: number;
};
type ConsumeSnapshot = { account: LevelStatus; user: LevelStatus };

const toStatus = (
  plan: { id: string; name: string } & PlanLimits,
  consumed: number,
): LevelStatus => ({
  planId: plan.id,
  planName: plan.name,
  monthlyAllowance: plan.monthlyAllowance,
  maxPerRequest: plan.maxPerRequest,
  consumed,
  remaining: Math.max(0, plan.monthlyAllowance - consumed),
});

const toViolation = (violation: {
  level: RuleLevel;
  rule: RuleType;
  limit: number;
  actual: number;
}) => ({
  level: violation.level,
  rule: violation.rule,
  limit: violation.limit,
  attempted: violation.actual,
});

const fromStored = (row: {
  limitsSnapshot?: unknown | null;
}): ConsumeSnapshot => {
  if (!row.limitsSnapshot || typeof row.limitsSnapshot !== 'object') {
    throw new Error('Stored consumption request has no limits snapshot');
  }
  return row.limitsSnapshot as ConsumeSnapshot;
};

export const createConsumeService = (db: PrismaClient) => ({
  async consume(accountId: string, input: CreateConsume) {
    return db.$transaction(async (tx) => {
      const month = getMonthStart(new Date().toISOString().slice(0, 7));
      const limitsRepository = createLimitRepository(tx);
      const requestRepository = createRequestRepository(tx);
      const usageRepository = createUsageRepository(tx);
      const user = await limitsRepository.findUser(accountId, input.userRef);

      if (!user) throw new NotFoundError('User not found');

      const fingerprint = createFingerprint(input.userRef, input.units);
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
        return {
          requestId: input.requestId,
          userRef: input.userRef,
          units: existing.units,
          accepted: existing.outcome === 'ACCEPTED',
          replayed: true,
          reason:
            existing.rejectedRule && existing.rejectedLevel
              ? toViolation(
                  (existing.violations?.[0] ?? {
                    level: existing.rejectedLevel,
                    rule: existing.rejectedRule,
                    limit: 0,
                    actual: existing.units,
                  }) as {
                    level: RuleLevel;
                    rule: RuleType;
                    limit: number;
                    actual: number;
                  },
                )
              : null,
          violations: (existing.violations ?? []).map((item) =>
            toViolation(
              item as {
                level: RuleLevel;
                rule: RuleType;
                limit: number;
                actual: number;
              },
            ),
          ),
          month: formatMonth(existing.month),
          processedAt: existing.processedAt,
          ...snapshot,
        };
      }

      const usage = await usageRepository.ensureAndLock({
        accountId,
        userId: user.id,
        month,
      });

      const evaluator = new RuleEvaluator();
      const decision = evaluator.evaluate({
        units: input.units,
        account: { limits: user.accountPlan, consumed: usage.accountConsumed },
        user: { limits: user.userPlan, consumed: usage.userConsumed },
      });

      let accountConsumed = usage.accountConsumed;
      let userConsumed = usage.userConsumed;
      if (decision.allowed) {
        const updated = await usageRepository.incrementBoth({
          accountId,
          userId: user.id,
          month,
          delta: input.units,
        });
        accountConsumed = updated.accountConsumed;
        userConsumed = updated.userConsumed;
      }

      const snapshot: ConsumeSnapshot = {
        account: toStatus(user.accountPlan, accountConsumed),
        user: toStatus(user.userPlan, userConsumed),
      };
      const violations = decision.violations.map(toViolation);
      const finalized = await requestRepository.finalize(claimed.id, {
        outcome: (decision.allowed ? 'ACCEPTED' : 'REJECTED') as Outcome,
        rejectedRule: decision.primary?.rule ?? null,
        rejectedLevel: decision.primary?.level ?? null,
        violations: decision.violations,
        limitsSnapshot: snapshot,
      });

      return {
        requestId: input.requestId,
        userRef: input.userRef,
        units: input.units,
        accepted: decision.allowed,
        replayed: false,
        reason: decision.primary ? toViolation(decision.primary) : null,
        violations,
        month: formatMonth(finalized.month),
        processedAt: finalized.processedAt,
        ...snapshot,
      };
    });
  },
});

export type ConsumeService = ReturnType<typeof createConsumeService>;
