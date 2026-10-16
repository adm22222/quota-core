import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import { listPlansQuerySchema } from './plans.schema.ts';
import { listPlansController, type PlanService } from './plans.controller.ts';
import type { AuthService } from '../auth/auth.service.ts';
import { createAuthenticateMiddleware } from '../../middleware/api-key-auth.middleware.ts';

interface PlanRoutesDependencies {
  planService: PlanService;
  authService: AuthService;
}

export const createPlanRoutes = ({
  planService,
  authService,
}: PlanRoutesDependencies) => {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  router.get(
    '/',
    authenticate,
    validate(listPlansQuerySchema, 'query'),
    listPlansController(planService),
  );

  return router;
};
