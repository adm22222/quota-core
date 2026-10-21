import type {
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.ts';
import type { PlanScope } from '../../shared/types.ts';

type PlanDb = PrismaClient | Prisma.TransactionClient;

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

export const createPlanRepository = (db: PlanDb) => ({
  findPlansByAccount(accountId: string, scope?: PlanScope) {
    return db.plan.findMany({
      where: {
        OR: [
          { isPredefined: true, ownerAccountId: null },
          { isPredefined: false, ownerAccountId: accountId },
        ],
        ...(scope ? { scope } : {}),
      },
      select: planSelect,
      orderBy: [{ isPredefined: 'desc' }, { createdAt: 'asc' }],
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
        ...planSelect,
        ownerAccountId: true,
      },
    });
  },

  createPlan(data: {
    name: string;
    scope: PlanScope;
    monthlyAllowance: number;
    maxPerRequest: number;
    ownerAccountId: string;
  }) {
    return db.plan.create({
      data: {
        name: data.name,
        scope: data.scope,
        monthlyAllowance: data.monthlyAllowance,
        maxPerRequest: data.maxPerRequest,
        ownerAccountId: data.ownerAccountId,
        isPredefined: false,
      },
      select: planSelect,
    });
  },

  updatePlan(
    planId: string,
    data: {
      name?: string;
      monthlyAllowance: number;
      maxPerRequest: number;
    },
  ) {
    return db.plan.update({
      where: { id: planId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        monthlyAllowance: data.monthlyAllowance,
        maxPerRequest: data.maxPerRequest,
      },
      select: planSelect,
    });
  },

  checkNameConflict(
    ownerAccountId: string,
    scope: PlanScope,
    name: string,
    excludePlanId?: string,
  ) {
    return db.plan.findFirst({
      where: {
        ownerAccountId,
        scope,
        name,
        ...(excludePlanId ? { NOT: { id: excludePlanId } } : {}),
      },
      select: { id: true },
    });
  },
});
