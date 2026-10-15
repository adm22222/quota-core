import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

type AccountDb = PrismaClient | Prisma.TransactionClient;

export const createAccountRepository = (db: AccountDb) => ({
  createAccount(data: { name: string; planId: string }) {
    return db.account.create({
      data: {
        name: data.name,
        accountPlanId: data.planId,
      },
      select: {
        id: true,
        name: true,
      },
    });
  },

  findStarterPlan() {
    return db.plan.findFirst({
      where: {
        name: 'Starter',
        scope: 'ACCOUNT',
        isPredefined: true,
        ownerAccountId: null,
      },
      select: {
        id: true,
      },
    });
  },
});
