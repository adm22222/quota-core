import type { ApiKeyRepository } from '../auth/api-key.repository.ts';
import type { createAccountRepository } from './account.repository.ts';
import type { RepositoryFactory } from '../../shared/transaction-manager.ts';

export type AccountRepositoryFactory = RepositoryFactory<
  ReturnType<typeof createAccountRepository>
>;

export type ApiKeyRepositoryFactory = RepositoryFactory<ApiKeyRepository>;
