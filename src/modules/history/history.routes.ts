import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';
import type { AuthService } from '../auth/auth.service.ts';
import { createHistoryController } from './history.controller.ts';
import { historyQuerySchema } from './history.schema.ts';
import type { HistoryService } from './history.service.ts';

export const createHistoryRoutes = (
  service: HistoryService,
  authService: AuthService,
) => {
  const router = Router();
  router.get(
    '/',
    createAuthenticateMiddleware(authService),
    validate(historyQuerySchema, 'query'),
    createHistoryController(service),
  );
  return router;
};
