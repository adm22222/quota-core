import type { PrismaClient, PlanScope } from '../../generated/prisma/client.ts';
import { AppError } from '../../shared/errors.ts';
import { createPlanRepository } from './plans.repository.ts';
import type { ListPlansQueryInput } from './plans.schema.ts';

const toResponsePlan = <T extends { ownerAccountId?: string | null }>(
  plan: T,
) => {
  const { ownerAccountId: _omit, ...rest } = plan;
  return rest;
};

export const createPlanService = (db: PrismaClient) => ({
  async listPlans(accountId: string, query: ListPlansQueryInput) {
    const repository = createPlanRepository(db);
    const items = await repository.findPlansByAccount(
      accountId,
      query.scope as PlanScope | undefined,
    );
    return { items };
  },

  async getPlan(accountId: string, planId: string) {
    const repository = createPlanRepository(db);
    const plan = await repository.findPlanByIdForAccount(planId, accountId);

    if (!plan) {
      throw new AppError('PlanNotFound', 'Plan not found', 404);
    }

    return toResponsePlan(plan);
  },
});
