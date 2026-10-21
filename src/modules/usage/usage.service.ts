import {
  formatMonth,
  getMonthStart,
  rejectFutureMonths,
} from '../../helpers/month.ts';
import { NotFoundError } from '../../shared/errors.ts';
import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import { createUsageRepository } from './usage.repository.ts';
import {
  userCursorSchema,
  type UsageQuery,
  type UserUsageQuery,
} from './usage.schema.ts';
import type { RepositoryFactory } from '../../shared/transaction-manager.ts';
import type { PlanWithLimits } from '../../shared/types.ts';

type UsageRepository = ReturnType<typeof createUsageRepository>;

const monthDate = (month?: string) => {
  const value = month ?? formatMonth(new Date());
  rejectFutureMonths(value);
  return getMonthStart(value);
};

const status = (plan: PlanWithLimits, consumed: number) => ({
  planId: plan.id,
  planName: plan.name,
  monthlyAllowance: plan.monthlyAllowance,
  maxPerRequest: plan.maxPerRequest,
  consumed,
  remaining: Math.max(0, plan.monthlyAllowance - consumed),
});

export const createUsageService = (deps: {
  usageRepositoryFactory: RepositoryFactory<UsageRepository>;
}) => {
  return {
    async getUsage(accountId: string, query: UsageQuery) {
      const month = monthDate(query.month);
      const usageRepository = deps.usageRepositoryFactory();
      const account = await usageRepository.getAccountUsage(accountId, month);
      if (!account) throw new NotFoundError('Account not found');
      const rows = await usageRepository.listUsersUsage(accountId, month, {
        limit: query.limit,
        cursor: decodeCursor(query.cursor, userCursorSchema),
      });
      const hasNextPage = rows.length > query.limit;
      const items = hasNextPage ? rows.slice(0, query.limit) : rows;
      return {
        month: formatMonth(month),
        account: status(account.accountPlan, account.usage[0]?.consumed ?? 0),
        users: items.map((row) => ({
          userRef: row.externalUserId,
          ...status(row.userPlan, row.usage[0]?.consumed ?? 0),
        })),
        nextCursor: hasNextPage
          ? encodeCursor(items[items.length - 1]?.externalUserId)
          : null,
      };
    },

    async getUserUsage(
      accountId: string,
      userRef: string,
      query: UserUsageQuery,
    ) {
      const month = monthDate(query.month);
      const usageRepository = deps.usageRepositoryFactory();
      const row = await usageRepository.getUserUsage(accountId, userRef, month);
      if (!row) throw new NotFoundError('User not found');
      return {
        month: formatMonth(month),
        user: {
          userRef: row.externalUserId,
          ...status(row.userPlan, row.usage[0]?.consumed ?? 0),
        },
        account: status(
          row.account.accountPlan,
          row.account.usage[0]?.consumed ?? 0,
        ),
      };
    },
  };
};

export type UsageService = ReturnType<typeof createUsageService>;
