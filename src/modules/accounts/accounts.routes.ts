import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import {
  createAccountSchema,
  updateAccountPlanSchema,
} from './accounts.schema.ts';
import {
  createAccountController,
  getCurrentAccountController,
  updateAccountPlanController,
  type AccountService,
} from './accounts.controller.ts';
import type { AuthService } from '../auth/auth.service.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';

interface AccountRoutesDependencies {
  accountService: AccountService;
  authService: AuthService;
}
export const createAccountRoutes = ({
  accountService,
  authService,
}: AccountRoutesDependencies) => {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);
  router.post(
    '/',
    validate(createAccountSchema),
    createAccountController(accountService),
  );

  router.get('/', authenticate, getCurrentAccountController);

  router.put(
    '/plan',
    authenticate,
    validate(updateAccountPlanSchema),
    updateAccountPlanController(accountService),
  );

  return router;
};
