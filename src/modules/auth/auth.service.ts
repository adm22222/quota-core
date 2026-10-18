import { UnauthorizedError } from '../../shared/errors.ts';
import type {
  ApiKeyRepository,
  AuthenticatedAccount,
} from './api-key.repository.ts';
import { hashApiKey } from './api-key.ts';

export const createAuthService = (apiKeyRepo: ApiKeyRepository) => ({
  async authenticateApiKey(apiKey: string): Promise<AuthenticatedAccount> {
    if (!apiKey.startsWith('qtc_')) {
      throw new UnauthorizedError('Invalid API key');
    }

    const keyHash = hashApiKey(apiKey);
    const account = await apiKeyRepo.findAccountByKeyHash(keyHash);

    if (!account) {
      throw new UnauthorizedError('Invalid API key');
    }

    return account;
  },
});

export type AuthService = ReturnType<typeof createAuthService>;
