import type { PrismaClient, Outcome } from '../../generated/prisma/client.ts';
import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import {
  formatMonth,
  getMonthStart,
  rejectFutureMonths,
} from '../../helpers/month.ts';
import { createHistoryRepository } from './history.repository.ts';
import type { HistoryQuery } from './history.schema.ts';
import { z } from 'zod';

const historyCursorSchema = z.object({
  processedAt: z.string().transform((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('invalid cursor');
    return date;
  }),
  id: z.string().uuid(),
});

export const createHistoryService = (db: PrismaClient) => {
  const repository = createHistoryRepository(db);
  return {
    async getHistory(accountId: string, query: HistoryQuery) {
      let month: Date | undefined;
      if (query.month) {
        rejectFutureMonths(query.month);
        month = getMonthStart(query.month);
      }
      const rows = await repository.listHistory({
        accountId,
        userRef: query.userRef,
        month,
        outcome: query.outcome as Outcome | undefined,
        limit: query.limit,
        cursor: decodeCursor(query.cursor, historyCursorSchema),
      });
      const hasNextPage = rows.length > query.limit;
      const items = hasNextPage ? rows.slice(0, query.limit) : rows;
      return {
        items: items.map((row) => {
          const snapshot = row.limitsSnapshot as {
            account: unknown;
            user: unknown;
          };
          const violations = (row.violations ?? []) as Array<{
            level: string;
            rule: string;
            limit: number;
            actual: number;
          }>;
          const mapViolation = ({
            actual,
            ...violation
          }: (typeof violations)[number]) => ({
            ...violation,
            attempted: actual,
          });
          return {
            requestId: row.requestId,
            userRef: row.userRef,
            units: row.units,
            outcome: row.outcome,
            reason: violations[0] ? mapViolation(violations[0]) : null,
            violations: violations.map(mapViolation),
            month: formatMonth(row.month),
            processedAt: row.processedAt,
            account: snapshot.account,
            user: snapshot.user,
          };
        }),
        nextCursor: hasNextPage
          ? encodeCursor({
              processedAt: items[items.length - 1]?.processedAt.toISOString(),
              id: items[items.length - 1]?.id,
            })
          : null,
      };
    },
  };
};

export type HistoryService = ReturnType<typeof createHistoryService>;
