import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAccountSchema } from './accounts.schema.ts';
import {
  createAccountController,
  type AccountService,
} from './accounts.controller.ts';

interface AccountRoutesDependencies {
  accountService: AccountService;
}
export const createAccountsRoutes = ({
  accountService,
}: AccountRoutesDependencies) => {
  const router = Router();

  router.post(
    '/',
    validate(createAccountSchema),
    createAccountController(accountService),
  );

  return router;
};
