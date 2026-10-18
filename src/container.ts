import { createAccountService } from './modules/accounts/accounts.service.ts';
import { createApiRoutes } from './api.routes.ts';
import { prisma } from './shared/prisma.ts';
import { createApiKeyRepository } from './modules/auth/api-key.repository.ts';
import { createAuthService } from './modules/auth/auth.service.ts';
import { createPlanService } from './modules/plans/plans.service.ts';
import { createPlanRoutes } from './modules/plans/plans.routes.ts';
import { createUserService } from './modules/users/users.service.ts';
import { createUserRoutes } from './modules/users/users.routes.ts';
import { createConsumeService } from './modules/consumption/consumption.service.ts';
import { createConsumeRoutes } from './modules/consumption/consume.routes.ts';
import { createUsageService } from './modules/usage/usage.service.ts';
import { createUsageRoutes } from './modules/usage/usage.routes.ts';
import { createHistoryService } from './modules/history/history.service.ts';
import { createHistoryRoutes } from './modules/history/history.routes.ts';
import { createAccountRoutes } from './modules/accounts/current-account.routes.ts';
import { createAccountsRoutes } from './modules/accounts/accounts.routes.ts';

const accountService = createAccountService(prisma);
const apiKeyRepository = createApiKeyRepository(prisma);
const planService = createPlanService(prisma);
const userService = createUserService(prisma);
const consumeService = createConsumeService(prisma);
const usageService = createUsageService(prisma);
const historyService = createHistoryService(prisma);

const authService = createAuthService(apiKeyRepository);
const accountRoutes = createAccountsRoutes({
  accountService,
});
const currentAccountRoutes = createAccountRoutes({
  accountService,
  authService,
});
const planRoutes = createPlanRoutes({ planService, authService });
const userRoutes = createUserRoutes({ userService, authService });
const consumeRoutes = createConsumeRoutes(consumeService, authService);
const usageRoutes = createUsageRoutes(usageService, authService);
const historyRoutes = createHistoryRoutes(historyService, authService);
export const apiRoutes = createApiRoutes({
  accountRoutes,
  currentAccountRoutes,
  planRoutes,
  userRoutes,
  consumeRoutes,
  usageRoutes,
  historyRoutes,
});
