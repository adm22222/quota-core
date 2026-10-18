import type { RequestHandler } from 'express';
import { createUserService } from './users.service.ts';
import {
  type CreateUserInput,
  type UserRefParamInput,
  type UpdateUserPlanInput,
  listUsersQuerySchema,
} from './users.schema.ts';
export type UserService = ReturnType<typeof createUserService>;
export const createUserController = (
  userService: UserService,
): RequestHandler<{}, unknown, CreateUserInput> => {
  return async (req, res, next) => {
    try {
      const user = await userService.createUser(req.account.id, req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };
};
export const listUsersController = (
  userService: UserService,
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const query = listUsersQuerySchema.parse(req.query);

      const result = await userService.listUsers(req.account.id, query);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
};
export const getUserController = (
  userService: UserService,
): RequestHandler<UserRefParamInput> => {
  return async (req, res, next) => {
    try {
      const user = await userService.getUserByRef(
        req.account.id,
        req.params.userRef,
      );
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };
};
export const updateUserPlanController = (
  userService: UserService,
): RequestHandler<UserRefParamInput, unknown, UpdateUserPlanInput> => {
  return async (req, res, next) => {
    try {
      const user = await userService.updateUserPlan(
        req.account.id,
        req.params.userRef,
        req.body,
      );
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };
};
