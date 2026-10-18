import { prisma } from '../../src/shared/prisma.ts';
import { seedPredefinedPlans } from '../../prisma/predefined-plans.ts';

export { prisma };

export const resetDb = async () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (!/_test(?:\?|$)/.test(databaseUrl)) {
    throw new Error('Refusing to reset: DATABASE_URL is not a test database');
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      consumption_requests,
      user_monthly_usage,
      account_monthly_usage,
      api_keys,
      users,
      accounts,
      plans
    RESTART IDENTITY
  `);

  await seedPredefinedPlans(prisma);
};
