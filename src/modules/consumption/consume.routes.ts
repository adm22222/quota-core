import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';
import type { AuthService } from '../auth/auth.service.ts';
import { createConsumeController } from './consume.controller.ts';
import { createConsume } from './consume.schema.ts';
import type { ConsumeService } from './consumption.service.ts';

export const createConsumeRoutes = (
  service: ConsumeService,
  authService: AuthService,
) => {
  const router = Router();
  router.post(
    '/',
    createAuthenticateMiddleware(authService),
    validate(createConsume),
    createConsumeController(service),
  );
  return router;
};
