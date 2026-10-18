import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';
import type {
  Outcome,
  RuleLevel,
  RuleType,
} from '../../generated/prisma/client.ts';

export interface ClaimedRequest {
  id: string;
  accountId: string;
  userId: string;
  requestId: string;
  units: number;
  payloadFingerprint: string;
  month: Date;
  processedAt: Date;
  outcome?: Outcome | null;
  rejectedRule?: RuleType | null;
  rejectedLevel?: RuleLevel | null;
  violations?: unknown[];
  limitsSnapshot?: unknown | null;
}

export interface FinalizeData {
  outcome: Outcome;
  rejectedRule: RuleType | null;
  rejectedLevel: RuleLevel | null;
  violations: unknown[];
  limitsSnapshot: unknown | null;
}

export interface FinalizedRequest extends ClaimedRequest {
  outcome: Outcome;
  rejectedRule: RuleType | null;
  rejectedLevel: RuleLevel | null;
  violations: unknown[];
  limitsSnapshot: unknown | null;
}

export const createRequestRepository = (
  db: PrismaClient | Prisma.TransactionClient,
) => ({
  async claim(data: {
    accountId: string;
    userId: string;
    requestId: string;
    units: number;
    payloadFingerprint: string;
    month: Date;
  }): Promise<ClaimedRequest | null> {
    const rows = await db.$queryRaw<ClaimedRequest[]>`
      INSERT INTO consumption_requests (
        account_id,
        user_id,
        request_id,
        units,
        payload_fingerprint,
        month
      ) VALUES (
        ${data.accountId}::uuid,
        ${data.userId}::uuid,
        ${data.requestId},
        ${data.units},
        ${data.payloadFingerprint},
        ${data.month}::date
      )
      ON CONFLICT (account_id, request_id) DO NOTHING
      RETURNING
        id::text AS id,
        account_id::text AS "accountId",
        user_id::text AS "userId",
        request_id AS "requestId",
        units,
        payload_fingerprint AS "payloadFingerprint",
        month,
        processed_at AS "processedAt"
    `;

    return rows[0] ?? null;
  },

  async findByRequestId(
    accountId: string,
    requestId: string,
  ): Promise<FinalizedRequest | null> {
    const rows = await db.$queryRaw<FinalizedRequest[]>`
      SELECT
        id::text AS id,
        account_id::text AS "accountId",
        user_id::text AS "userId",
        request_id AS "requestId",
        units,
        payload_fingerprint AS "payloadFingerprint",
        outcome,
        rejected_rule AS "rejectedRule",
        rejected_level AS "rejectedLevel",
        violations,
        limits_snapshot AS "limitsSnapshot",
        month,
        processed_at        AS "processedAt"
      FROM consumption_requests
      WHERE account_id = ${accountId}::uuid
        AND request_id = ${requestId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  },

  async finalize(id: string, payload: FinalizeData): Promise<FinalizedRequest> {
    const snapshotJson =
      payload.limitsSnapshot !== null
        ? JSON.stringify(payload.limitsSnapshot)
        : null;

    const rows = await db.$queryRaw<FinalizedRequest[]>`
      UPDATE consumption_requests
      SET
        outcome = ${payload.outcome}::"outcome",
        rejected_rule = ${payload.rejectedRule}::"rule_type",
        rejected_level = ${payload.rejectedLevel}::"rule_level",
        violations = ${JSON.stringify(payload.violations)}::jsonb,
        limits_snapshot = ${snapshotJson}::jsonb,
        processed_at = CURRENT_TIMESTAMP
      WHERE id = ${id}::uuid
        AND outcome IS NULL
      RETURNING
        id::text AS id,
        account_id::text AS "accountId",
        user_id::text AS "userId",
        request_id AS "requestId",
        units,
        payload_fingerprint AS "payloadFingerprint",
        outcome,
        rejected_rule AS "rejectedRule",
        rejected_level AS "rejectedLevel",
        violations,
        limits_snapshot AS "limitsSnapshot",
        month,
        processed_at AS "processedAt"
    `;

    if (!rows[0]) {
      throw new Error(`ConsumptionRequest ${id} not found during finalize`);
    }

    return rows[0];
  },
});

export type RequestRepository = ReturnType<typeof createRequestRepository>;
