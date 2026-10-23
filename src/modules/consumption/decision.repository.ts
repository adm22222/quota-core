import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';
import type { ConsumeSnapshot } from './consumption.types.ts';

export interface PlanRow {
  id: string;
  name: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface DecisionContext {
  accountPlan: PlanRow;
  userPlan: PlanRow;
  userConsumed: number;
}

export const createDecisionRepository = (
  db: PrismaClient | Prisma.TransactionClient,
) => ({
  async lockAccountUsage(
    accountId: string,
    month: Date,
  ): Promise<number | null> {
    const rows = await db.$queryRaw<{ consumed: number }[]>`
      SELECT consumed
      FROM account_monthly_usage
      WHERE account_id = ${accountId}::uuid
        AND month = ${month}::date
      FOR UPDATE
    `;
    return rows[0]?.consumed ?? null;
  },

  async ensureAccountUsage(accountId: string, month: Date): Promise<void> {
    await db.$executeRaw`
      INSERT INTO account_monthly_usage (account_id, month, consumed)
      VALUES (${accountId}::uuid, ${month}::date, 0)
      ON CONFLICT (account_id, month) DO NOTHING
    `;
  },

  async readContext(userId: string, month: Date): Promise<DecisionContext> {
    const rows = await db.$queryRaw<
      {
        accountPlanId: string;
        accountPlanName: string;
        accountAllowance: number;
        accountMax: number;
        userPlanId: string;
        userPlanName: string;
        userAllowance: number;
        userMax: number;
        userConsumed: number;
      }[]
    >`
      SELECT
        ap.id::text AS "accountPlanId", ap.name AS "accountPlanName",
        ap.monthly_allowance AS "accountAllowance", ap.max_per_request AS "accountMax",
        up.id::text AS "userPlanId", up.name AS "userPlanName",
        up.monthly_allowance AS "userAllowance", up.max_per_request AS "userMax",
        COALESCE(uu.consumed, 0) AS "userConsumed"
      FROM users u
      JOIN accounts a ON a.id = u.account_id
      JOIN plans ap ON ap.id = a.account_plan_id
      JOIN plans up ON up.id = u.user_plan_id
      LEFT JOIN user_monthly_usage uu ON uu.user_id = u.id AND uu.month = ${month}::date
      WHERE u.id = ${userId}::uuid
    `;
    const r = rows[0];
    if (!r) throw new Error(`user ${userId} disappeared while consuming`);
    return {
      accountPlan: {
        id: r.accountPlanId,
        name: r.accountPlanName,
        monthlyAllowance: r.accountAllowance,
        maxPerRequest: r.accountMax,
      },
      userPlan: {
        id: r.userPlanId,
        name: r.userPlanName,
        monthlyAllowance: r.userAllowance,
        maxPerRequest: r.userMax,
      },
      userConsumed: r.userConsumed,
    };
  },

  async recordAccepted(input: {
    requestRowId: string;
    accountId: string;
    userId: string;
    month: Date;
    units: number;
    snapshot: ConsumeSnapshot;
  }): Promise<{ processedAt: Date }> {
    const { requestRowId, accountId, userId, month, units, snapshot } = input;
    const rows = await db.$queryRaw<{ processedAt: Date }[]>`
      WITH a AS (
        UPDATE account_monthly_usage
        SET consumed = consumed + ${units}, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ${accountId}::uuid AND month = ${month}::date
        RETURNING 1
      ), u AS (
        INSERT INTO user_monthly_usage (user_id, month, account_id, consumed)
        VALUES (${userId}::uuid, ${month}::date, ${accountId}::uuid, ${units})
        ON CONFLICT (user_id, month) DO UPDATE
          SET consumed = user_monthly_usage.consumed + EXCLUDED.consumed, updated_at = CURRENT_TIMESTAMP
        RETURNING 1
      )
      UPDATE consumption_requests
      SET outcome = 'ACCEPTED'::"outcome",
          rejected_rule = NULL,
          rejected_level = NULL,
          violations = '[]'::jsonb,
          limits_snapshot = ${JSON.stringify(snapshot)}::jsonb,
          processed_at = clock_timestamp()
      WHERE id = ${requestRowId}::uuid
        AND outcome IS NULL
        AND EXISTS (SELECT 1 FROM a)
        AND EXISTS (SELECT 1 FROM u)
      RETURNING processed_at AS "processedAt"
    `;
    if (!rows[0])
      throw new Error(
        `recordAccepted updated nothing for request ${requestRowId}`,
      );
    return rows[0];
  },
});

export type DecisionRepository = ReturnType<typeof createDecisionRepository>;
