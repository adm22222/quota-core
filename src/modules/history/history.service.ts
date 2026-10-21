import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import {
  formatMonth,
  getMonthStart,
  rejectFutureMonths,
} from '../../helpers/month.ts';
import { createHistoryRepository } from './history.repository.ts';
import { historyCursorSchema, type HistoryQuery } from './history.schema.ts';
import type { RuleViolation } from '../../shared/types.ts';

import type { RepositoryFactory } from '../../shared/transaction-manager.ts';

type HistoryRepository = ReturnType<typeof createHistoryRepository>;

export const createHistoryService = (deps: {
  historyRepositoryFactory: RepositoryFactory<HistoryRepository>;
}) => {
  return {
    async getHistory(accountId: string, query: HistoryQuery) {
      const repository = deps.historyRepositoryFactory();
      let month: Date | undefined;
      if (query.month) {
        rejectFutureMonths(query.month);
        month = getMonthStart(query.month);
      }
      const rows = await repository.listHistory({
        accountId,
        userRef: query.userRef,
        month,
        outcome: query.outcome,
        limit: query.limit,
        cursor: decodeCursor(query.cursor, historyCursorSchema),
      });
      const hasNextPage = rows.length > query.limit;
      const items = hasNextPage ? rows.slice(0, query.limit) : rows;
      return {
        items: items.map((row) => {
          const snapshot = row.limitsSnapshot;
          const violations: Pick<
            RuleViolation,
            'level' | 'rule' | 'limit' | 'actual'
          >[] = row.violations ?? [];
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
