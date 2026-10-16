import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import {
  createUserSchema,
  listUsersQuerySchema,
  userRefParamSchema,
  updateUserPlanSchema,
} from './users.schema.ts';
import {
  createUserController,
  listUsersController,
  getUserController,
  updateUserPlanController,
  type UserService,
} from './users.controller.ts';
import type { AuthService } from '../auth/auth.service.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';

interface UserRoutesDependencies {
  userService: UserService;
  authService: AuthService;
}

export const createUserRoutes = ({
  userService,
  authService,
}: UserRoutesDependencies) => {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  router.post(
    '/',
    authenticate,
    validate(createUserSchema),
    createUserController(userService),
  );

  router.get(
    '/',
    authenticate,
    validate(listUsersQuerySchema, 'query'),
    listUsersController(userService),
  );

  router.get(
    '/:userRef',
    authenticate,
    validate(userRefParamSchema, 'params'),
    getUserController(userService),
  );

  router.put(
    '/:userRef/plan',
    authenticate,
    validate(userRefParamSchema, 'params'),
    validate(updateUserPlanSchema),
    updateUserPlanController(userService),
  );

  return router;
};
