import type { RequestHandler } from 'express';
import { createAccountService } from './accounts.service.ts';
import type { CreateAccountInput } from './accounts.schema.ts';

export type AccountService = ReturnType<typeof createAccountService>;

export const createAccountController = (
  accountService: AccountService,
): RequestHandler<{}, unknown, CreateAccountInput> => {
  return async (req, res, next) => {
    try {
      const result = await accountService.createAccount(req.body);

      res.status(201).json({
        account: result.account,
        apiKey: result.apiKey,
      });
    } catch (error) {
      next(error);
    }
  };
};
