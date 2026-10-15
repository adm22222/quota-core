import type { RequestHandler } from 'express';
import { createAccountService } from './accounts.service.ts';
import type {
  CreateAccountInput,
  UpdateAccountPlanInput,
} from './accounts.schema.ts';

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

export const getCurrentAccountController: RequestHandler = (req, res) => {
  res.status(200).json({
    account: req.account,
  });
};

export const updateAccountPlanController = (
  accountService: AccountService,
): RequestHandler<{}, unknown, UpdateAccountPlanInput> => {
  return async (req, res, next) => {
    try {
      const account = await accountService.updateAccountPlan(
        req.account.id,
        req.body.planId,
      );

      res.status(200).json({ account });
    } catch (error) {
      next(error);
    }
  };
};
