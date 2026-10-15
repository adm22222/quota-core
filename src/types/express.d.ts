import type { ApiKeyAccount } from '../modules/api-keys/api-key.repository.ts';

declare global {
  namespace Express {
    interface Request {
      account: ApiKeyAccount;
    }
  }
}

export {};
