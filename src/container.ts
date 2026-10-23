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
import { createTransactionManager } from './shared/transaction-manager.ts';
import { createAccountRepository } from './modules/accounts/account.repository.ts';
import { createPlanRepository } from './modules/plans/plans.repository.ts';
import { createUserRepository } from './modules/users/users.repository.ts';
import { createLimitRepository } from './modules/consumption/limits.repository.ts';
import { createRequestRepository } from './modules/consumption/request.repository.ts';
import { createUsageRepository } from './modules/usage/usage.repository.ts';
import { createHistoryRepository } from './modules/history/history.repository.ts';
import { createRepositoryFactory } from './shared/repository-factory.ts';
import { createDecisionRepository } from './modules/consumption/decision.repository.ts';

const transactionManager = createTransactionManager(prisma);
const accountRepositoryFactory = createRepositoryFactory(
  createAccountRepository,
);
const apiKeyRepositoryFactory = createRepositoryFactory(createApiKeyRepository);
const planRepositoryFactory = createRepositoryFactory(createPlanRepository);
const userRepositoryFactory = createRepositoryFactory(createUserRepository);
const limitRepositoryFactory = createRepositoryFactory(createLimitRepository);
const requestRepositoryFactory = createRepositoryFactory(
  createRequestRepository,
);
const usageRepositoryFactory = createRepositoryFactory(createUsageRepository);
const historyRepositoryFactory = createRepositoryFactory(
  createHistoryRepository,
);
const decisionRepositoryFactory = createRepositoryFactory(
  createDecisionRepository,
);

const accountService = createAccountService({
  accountRepositoryFactory,
  apiKeyRepositoryFactory,
  transactionManager,
});
const apiKeyRepository = apiKeyRepositoryFactory();
const planService = createPlanService({
  planRepositoryFactory,
  transactionManager,
});
const userService = createUserService({
  userRepositoryFactory,
  transactionManager,
});
const consumeService = createConsumeService({
  limitRepositoryFactory,
  requestRepositoryFactory,
  decisionRepositoryFactory,
  transactionManager,
});
const usageService = createUsageService({ usageRepositoryFactory });
const historyService = createHistoryService({ historyRepositoryFactory });

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
