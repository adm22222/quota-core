import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

export const createUsageRepository = (
  db: PrismaClient | Prisma.TransactionClient,
) => ({
  async getAccountUsage(accountId: string, month: Date) {
    return db.account.findUnique({
      where: { id: accountId },
      select: {
        accountPlan: {
          select: {
            id: true,
            name: true,
            monthlyAllowance: true,
            maxPerRequest: true,
          },
        },
        usage: { where: { month }, select: { consumed: true } },
      },
    });
  },

  async listUsersUsage(
    accountId: string,
    month: Date,
    options: { limit: number; cursor?: string },
  ) {
    return db.user.findMany({
      where: { accountId },
      orderBy: { externalUserId: 'asc' },
      take: options.limit + 1,
      ...(options.cursor
        ? {
            cursor: {
              accountId_externalUserId: {
                accountId,
                externalUserId: options.cursor,
              },
            },
            skip: 1,
          }
        : {}),
      select: {
        externalUserId: true,
        userPlan: {
          select: {
            id: true,
            name: true,
            monthlyAllowance: true,
            maxPerRequest: true,
          },
        },
        usage: { where: { month }, select: { consumed: true } },
      },
    });
  },

  async getUserUsage(accountId: string, userRef: string, month: Date) {
    return db.user.findUnique({
      where: {
        accountId_externalUserId: { accountId, externalUserId: userRef },
      },
      select: {
        externalUserId: true,
        userPlan: {
          select: {
            id: true,
            name: true,
            monthlyAllowance: true,
            maxPerRequest: true,
          },
        },
        usage: { where: { month }, select: { consumed: true } },
        account: {
          select: {
            accountPlan: {
              select: {
                id: true,
                name: true,
                monthlyAllowance: true,
                maxPerRequest: true,
              },
            },
            usage: { where: { month }, select: { consumed: true } },
          },
        },
      },
    });
  },

});

export type UsageRepository = ReturnType<typeof createUsageRepository>;
