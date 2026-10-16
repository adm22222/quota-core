import type { PrismaClient, PlanScope } from '../../generated/prisma/client.ts';
import {
  AppError,
  ConflictError,
  ForbiddenError,
} from '../../shared/errors.ts';
import { createPlanRepository } from './plans.repository.ts';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  ListPlansQueryInput,
} from './plans.schema.ts';

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

  async createPlan(accountId: string, data: CreatePlanInput) {
    return db.$transaction(async (tx) => {
      const repository = createPlanRepository(tx);

      const conflict = await repository.checkNameConflict(
        accountId,
        data.scope as PlanScope,
        data.name,
      );

      if (conflict) {
        throw new ConflictError(
          `A plan named "${data.name}" already exists for scope ${data.scope} in this account`,
        );
      }

      return repository.createPlan({
        name: data.name,
        scope: data.scope as PlanScope,
        monthlyAllowance: data.monthlyAllowance,
        maxPerRequest: data.maxPerRequest,
        ownerAccountId: accountId,
      });
    });
  },

  async getPlan(accountId: string, planId: string) {
    const repository = createPlanRepository(db);
    const plan = await repository.findPlanByIdForAccount(planId, accountId);

    if (!plan) {
      throw new AppError('PlanNotFound', 'Plan not found', 404);
    }

    return toResponsePlan(plan);
  },

  async updatePlan(accountId: string, planId: string, data: UpdatePlanInput) {
    return db.$transaction(async (tx) => {
      const repository = createPlanRepository(tx);

      const plan = await repository.findPlanByIdForAccount(planId, accountId);

      if (!plan) {
        throw new AppError('PlanNotFound', 'Plan not found', 404);
      }

      if (plan.isPredefined) {
        throw new ForbiddenError('Predefined plans are read-only');
      }

      if (data.name !== undefined && data.name !== plan.name) {
        const conflict = await repository.checkNameConflict(
          accountId,
          plan.scope,
          data.name,
          planId,
        );

        if (conflict) {
          throw new ConflictError(
            `A plan named "${data.name}" already exists for scope ${plan.scope} in this account`,
          );
        }
      }

      return repository.updatePlan(planId, {
        name: data.name,
        monthlyAllowance: data.monthlyAllowance,
        maxPerRequest: data.maxPerRequest,
      });
    });
  },
});
