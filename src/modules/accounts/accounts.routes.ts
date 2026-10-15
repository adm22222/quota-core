import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAccountSchema } from './accounts.schema.ts';
import {
  createAccountController,
  type AccountService,
} from './accounts.controller.ts';

export const createAccountRoutes = (accountService: AccountService) => {
  const router = Router();

  router.post(
    '/',
    validate(createAccountSchema),
    createAccountController(accountService),
  );

  return router;
};
