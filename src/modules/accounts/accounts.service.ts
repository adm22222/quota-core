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
});
