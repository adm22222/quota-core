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
import type {
  RepositoryFactory,
  TransactionManager,
} from '../../shared/transaction-manager.ts';

const toResponsePlan = <T extends { ownerAccountId?: string | null }>(
  plan: T,
) => {
  const { ownerAccountId: _omit, ...rest } = plan;
  return rest;
};

type PlanRepository = ReturnType<typeof createPlanRepository>;

export const createPlanService = (deps: {
  planRepositoryFactory: RepositoryFactory<PlanRepository>;
  transactionManager: TransactionManager;
}) => ({
  async listPlans(accountId: string, query: ListPlansQueryInput) {
    const repository = deps.planRepositoryFactory();
    const items = await repository.findPlansByAccount(
      accountId,
      query.scope,
    );
    return { items };
  },

  async createPlan(accountId: string, data: CreatePlanInput) {
    return deps.transactionManager.run(async (tx) => {
      const repository = deps.planRepositoryFactory(tx);

      const conflict = await repository.checkNameConflict(
        accountId,
        data.scope,
        data.name,
      );

      if (conflict) {
        throw new ConflictError(
          `A plan named "${data.name}" already exists for scope ${data.scope} in this account`,
        );
      }

      return repository.createPlan({
        name: data.name,
        scope: data.scope,
        monthlyAllowance: data.monthlyAllowance,
        maxPerRequest: data.maxPerRequest,
        ownerAccountId: accountId,
      });
    });
  },

  async getPlan(accountId: string, planId: string) {
    const repository = deps.planRepositoryFactory();
    const plan = await repository.findPlanByIdForAccount(planId, accountId);

    if (!plan) {
      throw new AppError('PlanNotFound', 'Plan not found', 404);
    }

    return toResponsePlan(plan);
  },

  async updatePlan(accountId: string, planId: string, data: UpdatePlanInput) {
    return deps.transactionManager.run(async (tx) => {
      const repository = deps.planRepositoryFactory(tx);

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
