import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAccountSchema } from './accounts.schema.ts';
import {
  createAccountController,
  getCurrentAccountController,
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

  router.post(
    '/',
    validate(createAccountSchema),
    createAccountController(accountService),
  );

  router.get(
    '/',
    createAuthenticateMiddleware(authService),
    getCurrentAccountController,
  );

  return router;
};
