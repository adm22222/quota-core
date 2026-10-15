import { createAccountService } from './modules/accounts/accounts.service.ts';
import { createAccountRoutes } from './modules/accounts/accounts.routes.ts';
import { createApiRoutes } from './api.routes.ts';
import { prisma } from './shared/prisma.ts';

const accountService = createAccountService(prisma);

const accountRoutes = createAccountRoutes(accountService);

export const apiRoutes = createApiRoutes({
  accountRoutes,
});
