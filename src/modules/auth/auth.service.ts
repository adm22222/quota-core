import { UnauthorizedError } from '../../shared/errors.ts';
import type {
  ApiKeyRepository,
  AuthenticatedAccount,
} from './api-key.repository.ts';
import { hashApiKey } from './api-key.ts';

export interface AuthService {
  authenticateApiKey(apiKey: string): Promise<AuthenticatedAccount | null>;
}

export const createAuthService = (apiKeyRepo: ApiKeyRepository) => {
  return {
    async authenticateApiKey(apiKey: string) {
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
  };
};
