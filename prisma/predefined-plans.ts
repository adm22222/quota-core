import type { PrismaClient } from '../src/generated/prisma/client.ts';

export const predefinedPlans = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Starter',
    scope: 'ACCOUNT',
    monthlyAllowance: 100_000,
    maxPerRequest: 10_000,
  },
  {
    id: '01111111-1111-4111-8111-111111111111',
    name: 'Pro',
    scope: 'ACCOUNT',
    monthlyAllowance: 1_000_000,
    maxPerRequest: 100_000,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Basic',
    scope: 'USER',
    monthlyAllowance: 10_000,
    maxPerRequest: 1_000,
  },
  {
    id: '02222222-2222-4222-8222-222222222222',
    name: 'Premium',
    scope: 'USER',
    monthlyAllowance: 100_000,
    maxPerRequest: 10_000,
  },
] as const;

export const seedPredefinedPlans = async (prisma: PrismaClient) => {
  for (const plan of predefinedPlans) {
    const existing = await prisma.plan.findUnique({
      where: { id: plan.id },
    });

    if (existing) {
      const matches =
        existing.name === plan.name &&
        existing.scope === plan.scope &&
        existing.isPredefined === true &&
        existing.ownerAccountId === null &&
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
