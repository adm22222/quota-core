import type { PrismaClient } from '../../generated/prisma/client.ts';
import { AppError } from '../../shared/errors.ts';
import { createApiKeyRepository } from '../auth/api-key.repository.ts';
import {
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
} from '../auth/api-key.ts';
import { createAccountRepository } from './account.repository.ts';
import type { CreateAccountInput } from './accounts.schema.ts';

export const createAccountService = (db: PrismaClient) => ({
  async createAccount(data: CreateAccountInput) {
    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);
    const prefixApiKey = getApiKeyPrefix(apiKey);
    const account = await db.$transaction(async (tx) => {
      const repository = createAccountRepository(tx);
      const apiKeyRepo = createApiKeyRepository(tx);
      const plan = await repository.findStarterPlan();
      if (!plan) {
        throw new AppError(
          'StarterPlanNotFound',
          'Starter plan not found',
          500,
        );
      }
      const account = await repository.createAccount({
        name: data.name,
        planId: plan.id,
      });
      await apiKeyRepo.saveKey({
        accountId: account.id,
        keyHash: hash,
        keyPrefix: prefixApiKey,
      });
      return account;
    });
    return {
      account,
      apiKey,
    };
  },
  async getAccountByApiKey(apikey: string) {
    const apiKeyRepo = createApiKeyRepository(db);
    const hash = hashApiKey(apikey);
    const account = await apiKeyRepo.findAccountByKeyHash(hash);
    return account;
  },

  async updateAccountPlan(accountId: string, planId: string) {
    return db.$transaction(async (tx) => {
      const repository = createAccountRepository(tx);

      const plan = await repository.findPlanById(planId);

      if (!plan) {
        throw new AppError('PlanNotFound', 'Plan not found', 404);
      }

      if (plan.scope !== 'ACCOUNT') {
        throw new AppError(
          'PlanScopeMismatch',
          'Plan scope must be ACCOUNT',
          422,
        );
      }

      const isPublicPredefinedPlan =
        plan.isPredefined && plan.ownerAccountId === null;

      const isOwnedCustomPlan =
        !plan.isPredefined && plan.ownerAccountId === accountId;

      if (!isPublicPredefinedPlan && !isOwnedCustomPlan) {
        throw new AppError('PlanNotFound', 'Plan not found', 404);
      }

      return repository.updateAccountPlan(accountId, planId);
    });
  },
});
