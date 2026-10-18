import type {
  Outcome,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.ts';

export interface HistoryRow {
  id: string;
  requestId: string;
  userRef: string;
  units: number;
  outcome: Outcome;
  violations: unknown[];
  limitsSnapshot: unknown;
  month: Date;
  processedAt: Date;
}

export const createHistoryRepository = (
  db: PrismaClient | Prisma.TransactionClient,
) => ({
  async listHistory(data: {
    accountId: string;
    userRef?: string;
    month?: Date;
    outcome?: Outcome;
    limit: number;
    cursor?: { processedAt: Date; id: string };
  }) {
    return db.$queryRaw<HistoryRow[]>`
        SELECT
          cr.id::text AS id,
          cr.request_id AS "requestId",
          u.external_user_id AS "userRef",
          cr.units,
          cr.outcome,
          cr.violations,
          cr.limits_snapshot AS "limitsSnapshot",
          cr.month,
          cr.processed_at AS "processedAt"
        FROM consumption_requests cr
        INNER JOIN users u ON u.id = cr.user_id AND u.account_id = cr.account_id
        WHERE cr.account_id = ${data.accountId}::uuid
          AND (${data.userRef ?? null}::text IS NULL OR u.external_user_id = ${data.userRef ?? null})
          AND (${data.month ?? null}::date IS NULL OR cr.month = ${data.month ?? null}::date)
          AND (${data.outcome ?? null}::text IS NULL OR cr.outcome = ${data.outcome ?? null}::"outcome")
          AND (
            ${data.cursor?.processedAt ?? null}::timestamptz IS NULL
            OR (cr.processed_at, cr.id) < (${data.cursor?.processedAt ?? null}::timestamptz, ${data.cursor?.id ?? null}::uuid)
          )
        ORDER BY cr.processed_at DESC, cr.id DESC
        LIMIT ${data.limit + 1}
      `;
  },
});
