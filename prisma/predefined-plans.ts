import type { PrismaClient } from '../src/generated/prisma/client.ts';

export const predefinedPlans = [
  {
    name: 'Starter',
    scope: 'ACCOUNT',
    monthlyAllowance: 10000,
    maxPerRequest: 100,
  },
  {
    name: 'Pro',
    scope: 'ACCOUNT',
    monthlyAllowance: 100000,
    maxPerRequest: 1000,
  },
  {
    name: 'Basic',
    scope: 'USER',
    monthlyAllowance: 1000,
    maxPerRequest: 20,
  },
] as const;
export const seedPredefinedPlans = async (prisma: PrismaClient) => {
  for (const plan of predefinedPlans) {
    const existing = await prisma.plan.findFirst({
      where: {
        name: plan.name,
        scope: plan.scope,
        isPredefined: true,
        ownerAccountId: null,
      },
    });

    if (existing) {
      const matches =
        existing.monthlyAllowance === plan.monthlyAllowance &&
        existing.maxPerRequest === plan.maxPerRequest;

      if (!matches) {
        throw new Error(`Predefined plan mismatch: ${plan.name}`);
      }

      continue;
    }

    await prisma.plan.create({
      data: {
        ...plan,
        isPredefined: true,
        ownerAccountId: null,
      },
    });
  }
};
