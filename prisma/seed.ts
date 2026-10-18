import { prisma } from '../src/shared/prisma.ts';
import { seedPredefinedPlans } from './predefined-plans.ts';

const main = async () => {
  await seedPredefinedPlans(prisma);
};

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
