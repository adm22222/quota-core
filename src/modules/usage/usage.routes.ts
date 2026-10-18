import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';
import type { AuthService } from '../auth/auth.service.ts';
import {
  createUsageController,
  createUserUsageController,
} from './usage.controller.ts';
import { usageQuerySchema, userUsageQuerySchema } from './usage.schema.ts';
import type { UsageService } from './usage.service.ts';
import { userRefParamSchema } from '../users/users.schema.ts';

export const createUsageRoutes = (
  service: UsageService,
  authService: AuthService,
) => {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  router.get(
    '/usage',
    authenticate,
    validate(usageQuerySchema, 'query'),
    createUsageController(service),
  );
  router.get(
    '/users/:userRef/usage',
    authenticate,
    validate(userRefParamSchema, 'params'),
    validate(userUsageQuerySchema, 'query'),
    createUserUsageController(service),
  );
  return router;
};
