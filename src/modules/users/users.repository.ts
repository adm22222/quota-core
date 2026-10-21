import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

type UserDb = PrismaClient | Prisma.TransactionClient;

const planSelect = {
  id: true,
  name: true,
  scope: true,
  isPredefined: true,
  monthlyAllowance: true,
  maxPerRequest: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userSelect = {
  externalUserId: true,
  createdAt: true,
  userPlan: { select: planSelect },
} as const;

export const createUserRepository = (db: UserDb) => ({
  findBasicPlan() {
    return db.plan.findFirst({
      where: {
        name: 'Basic',
        scope: 'USER',
        isPredefined: true,
        ownerAccountId: null,
      },
      select: { id: true },
    });
  },

  findPlanByIdForAccount(planId: string, accountId: string) {
    return db.plan.findFirst({
      where: {
        id: planId,
        OR: [
          { isPredefined: true, ownerAccountId: null },
          { isPredefined: false, ownerAccountId: accountId },
        ],
      },
      select: {
        id: true,
        scope: true,
        isPredefined: true,
        ownerAccountId: true,
      },
    });
  },

  findUserByRef(accountId: string, userRef: string) {
    return db.user.findUnique({
      where: {
        accountId_externalUserId: { accountId, externalUserId: userRef },
      },
      select: userSelect,
    });
  },

  createUser(data: {
    accountId: string;
    userRef: string;
    planId: string;
  }) {
    return db.user.create({
      data: {
        accountId: data.accountId,
        externalUserId: data.userRef,
        userPlanId: data.planId,
      },
      select: userSelect,
    });
  },

  listUsers(
    accountId: string,
    opts: { limit: number; cursor?: string },
  ) {
    return db.user.findMany({
      where: { accountId },
      select: userSelect,
      orderBy: { externalUserId: 'asc' },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { accountId_externalUserId: { accountId, externalUserId: opts.cursor } },
            skip: 1,
          }
        : {}),
    });
  },

  updateUserPlan(accountId: string, userRef: string, planId: string) {
    return db.user.update({
      where: {
        accountId_externalUserId: { accountId, externalUserId: userRef },
      },
      data: { userPlanId: planId },
      select: userSelect,
    });
  },
});
