import {
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors.ts';
import {
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
} from '../auth/api-key.ts';
import type {
  TransactionManager,
} from '../../shared/transaction-manager.ts';
import type { CreateAccountInput } from './accounts.schema.ts';
import type {
  AccountRepositoryFactory,
  ApiKeyRepositoryFactory,
} from './accounts.types.ts';

export const createAccountService = (deps: {
  accountRepositoryFactory: AccountRepositoryFactory;
  apiKeyRepositoryFactory: ApiKeyRepositoryFactory;
  transactionManager: TransactionManager;
}) => ({
  async createAccount(data: CreateAccountInput) {
    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);
    const prefixApiKey = getApiKeyPrefix(apiKey);
    const account = await deps.transactionManager.run(async (tx) => {
      const repository = deps.accountRepositoryFactory(tx);
      const apiKeyRepo = deps.apiKeyRepositoryFactory(tx);

      const plan = await repository.findStarterPlan();
      if (!plan) {
        throw new NotFoundError('Starter plan not found');
      }
      const planId = data.planId ?? plan.id;

      const selectedPlan = await repository.findPlanById(planId);

      if (!selectedPlan) {
        throw new NotFoundError('Plan not found');
      }
      if (selectedPlan.scope !== 'ACCOUNT') {
        throw new UnprocessableEntityError('Plan scope must be ACCOUNT');
      }

      if (!selectedPlan.isPredefined && selectedPlan.ownerAccountId !== null) {
        throw new UnprocessableEntityError(
          'Only predefined plans can be used for new accounts',
        );
      }
      const account = await repository.createAccount({
        name: data.name,
        planId: selectedPlan.id,
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
    const apiKeyRepo = deps.apiKeyRepositoryFactory();
    const hash = hashApiKey(apikey);
    const account = await apiKeyRepo.findAccountByKeyHash(hash);
    return account;
  },

  async updateAccountPlan(accountId: string, planId: string) {
    return deps.transactionManager.run(async (tx) => {
      const repository = deps.accountRepositoryFactory(tx);

      const plan = await repository.findPlanById(planId);

      if (!plan) {
        throw new NotFoundError('Plan not found');
      }

      if (plan.scope !== 'ACCOUNT') {
        throw new UnprocessableEntityError('Plan scope must be ACCOUNT');
      }

      const isPublicPredefinedPlan =
        plan.isPredefined && plan.ownerAccountId === null;

      const isOwnedCustomPlan =
        !plan.isPredefined && plan.ownerAccountId === accountId;

      if (!isPublicPredefinedPlan && !isOwnedCustomPlan) {
        throw new NotFoundError('Plan not found for this account');
      }

      return repository.updateAccountPlan(accountId, planId);
    });
  },
});
