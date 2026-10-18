import type { PrismaClient } from '../../generated/prisma/client.ts';
import {
  formatMonth,
  getMonthStart,
  rejectFutureMonths,
} from '../../helpers/month.ts';
import { NotFoundError } from '../../shared/errors.ts';
import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import { z } from 'zod';
import { createUsageRepository } from './usage.repository.ts';
import type { UsageQuery, UserUsageQuery } from './usage.schema.ts';
import type { PlanLimits } from '../rules/rule.types.ts';

type Plan = { id: string; name: string } & PlanLimits;

const monthDate = (month?: string) => {
  const value = month ?? formatMonth(new Date());
  rejectFutureMonths(value);
  return getMonthStart(value);
};

const status = (plan: Plan, consumed: number) => ({
  planId: plan.id,
  planName: plan.name,
  monthlyAllowance: plan.monthlyAllowance,
  maxPerRequest: plan.maxPerRequest,
  consumed,
  remaining: Math.max(0, plan.monthlyAllowance - consumed),
});

const userCursorSchema = z.string().min(1);

export const createUsageService = (db: PrismaClient) => {
  const usageRepository = createUsageRepository(db);

  return {
    async getUsage(accountId: string, query: UsageQuery) {
      const month = monthDate(query.month);
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
