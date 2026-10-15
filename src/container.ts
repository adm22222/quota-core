import { createAccountService } from './modules/accounts/accounts.service.ts';
import { createAccountRoutes } from './modules/accounts/accounts.routes.ts';
import { createApiRoutes } from './api.routes.ts';
import { prisma } from './shared/prisma.ts';
import { createApiKeyRepository } from './modules/auth/api-key.repository.ts';
import { createAuthService } from './modules/auth/auth.service.ts';

const accountService = createAccountService(prisma);
const apiKeyRepository = createApiKeyRepository(prisma);

const authService = createAuthService(apiKeyRepository);
const accountRoutes = createAccountRoutes({
  accountService,
  authService,
});

export const apiRoutes = createApiRoutes({
  accountRoutes,
});
