import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

export interface MonthlyUsageRow {
  consumed: number;
}

export interface UsageLockResult {
  accountConsumed: number;
  userConsumed: number;
}

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

  async ensureAndLock(data: {
    accountId: string;
    userId: string;
    month: Date;
  }): Promise<UsageLockResult> {
    // 1. Upsert account row (no lock yet)
    await db.$executeRaw`
      INSERT INTO account_monthly_usage (account_id, month, consumed)
      VALUES (${data.accountId}::uuid, ${data.month}::date, 0)
      ON CONFLICT (account_id, month) DO NOTHING
    `;

    // 2. Upsert user row (no lock yet)
    await db.$executeRaw`
      INSERT INTO user_monthly_usage (user_id, account_id, month, consumed)
      VALUES (
        ${data.userId}::uuid,
        ${data.accountId}::uuid,
        ${data.month}::date,
        0
      )
      ON CONFLICT (user_id, month) DO NOTHING
    `;

    // 3. Lock account row first (fixed ordering: account before user)
    const accountRows = await db.$queryRaw<MonthlyUsageRow[]>`
      SELECT consumed
      FROM account_monthly_usage
      WHERE account_id = ${data.accountId}::uuid
        AND month = ${data.month}::date
      FOR UPDATE
    `;

    // 4. Lock user row second
    const userRows = await db.$queryRaw<MonthlyUsageRow[]>`
      SELECT consumed
      FROM user_monthly_usage
      WHERE user_id = ${data.userId}::uuid
        AND month  = ${data.month}::date
      FOR UPDATE
    `;

    const accountUsage = accountRows[0];
    const userUsage = userRows[0];

    if (!accountUsage || !userUsage) {
      throw new Error('Monthly usage rows could not be loaded');
    }

    return {
      accountConsumed: accountUsage.consumed,
      userConsumed: userUsage.consumed,
    };
  },

  async incrementAccount(data: {
    accountId: string;
    month: Date;
    delta: number;
  }): Promise<number> {
    const rows = await db.$queryRaw<MonthlyUsageRow[]>`
      UPDATE account_monthly_usage
      SET consumed = consumed + ${data.delta}
      WHERE account_id = ${data.accountId}::uuid
        AND month      = ${data.month}::date
      RETURNING consumed
    `;

    if (!rows[0]) {
      throw new Error(
        `account_monthly_usage row not found for account ${data.accountId} month ${data.month.toISOString()}`,
      );
    }

    return rows[0].consumed;
  },

  async incrementUser(data: {
    userId: string;
    month: Date;
    delta: number;
  }): Promise<number> {
    const rows = await db.$queryRaw<MonthlyUsageRow[]>`
      UPDATE user_monthly_usage
      SET consumed = consumed + ${data.delta}
      WHERE user_id = ${data.userId}::uuid
        AND month   = ${data.month}::date
      RETURNING consumed
    `;

    if (!rows[0]) {
      throw new Error(
        `user_monthly_usage row not found for user ${data.userId} month ${data.month.toISOString()}`,
      );
    }

    return rows[0].consumed;
  },

  async incrementBoth(data: {
    accountId: string;
    userId: string;
    month: Date;
    delta: number;
  }): Promise<{ accountConsumed: number; userConsumed: number }> {
    const accountConsumed = await this.incrementAccount({
      accountId: data.accountId,
      month: data.month,
      delta: data.delta,
    });
    const userConsumed = await this.incrementUser({
      userId: data.userId,
      month: data.month,
      delta: data.delta,
    });

    return { accountConsumed, userConsumed };
  },
});

export type UsageRepository = ReturnType<typeof createUsageRepository>;
