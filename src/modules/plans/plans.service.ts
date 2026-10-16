import type { PrismaClient, PlanScope } from '../../generated/prisma/client.ts';
import { createPlanRepository } from './plans.repository.ts';
import type { ListPlansQueryInput } from './plans.schema.ts';

export const createPlanService = (db: PrismaClient) => ({
  async listPlans(accountId: string, query: ListPlansQueryInput) {
    const repository = createPlanRepository(db);
    const items = await repository.findPlansByAccount(
      accountId,
      query.scope as PlanScope | undefined,
    );
    return { items };
  },
});
