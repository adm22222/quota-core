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
        accountPlan: true,
        createdAt: true,
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

  findPlanById(id: string) {
    return db.plan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        scope: true,
        isPredefined: true,
        ownerAccountId: true,
        monthlyAllowance: true,
        maxPerRequest: true,
      },
    });
  },

  updateAccountPlan(accountId: string, planId: string) {
    return db.account.update({
      where: { id: accountId },
      data: { accountPlanId: planId },
      select: {
        id: true,
        name: true,
        accountPlan: true,
        createdAt: true,
      },
    });
  },
});
