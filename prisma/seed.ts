import { prisma } from '../src/shared/prisma.ts';

const predefinedPlans = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Starter',
    scope: 'ACCOUNT' as const,
    monthlyAllowance: 100_000,
    maxPerRequest: 10_000,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Basic',
    scope: 'USER' as const,
    monthlyAllowance: 10_000,
    maxPerRequest: 1_000,
  },
];

const main = async () => {
  for (const plan of predefinedPlans) {
    const existing = await prisma.plan.findUnique({
      where: { id: plan.id },
    });

    if (existing) {
      if (
        existing.name !== plan.name ||
        existing.scope !== plan.scope ||
        existing.isPredefined !== true ||
        existing.ownerAccountId !== null
      ) {
        throw new Error(`Predefined plan identity mismatch: ${plan.name}`);
      }

      await prisma.plan.update({
        where: { id: plan.id },
        data: {
          monthlyAllowance: plan.monthlyAllowance,
          maxPerRequest: plan.maxPerRequest,
        },
      });
    } else {
      await prisma.plan.create({
        data: {
          ...plan,
          isPredefined: true,
          ownerAccountId: null,
        },
      });
    }

    console.log(`Seeded predefined plan: ${plan.name}`);
  }
};

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
