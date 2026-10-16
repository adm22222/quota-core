import { Router } from 'express';
import { validate } from '../../middleware/validate.ts';
import {
  createPlanSchema,
  listPlansQuerySchema,
  planIdParamSchema,
  updatePlanSchema,
} from './plans.schema.ts';
import {
  createPlanController,
  getPlanController,
  listPlansController,
  updatePlanController,
  type PlanService,
} from './plans.controller.ts';
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

  router.post(
    '/',
    authenticate,
    validate(createPlanSchema),
    createPlanController(planService),
  );

  router.get(
    '/:planId',
    authenticate,
    validate(planIdParamSchema, 'params'),
    getPlanController(planService),
  );

  router.put(
    '/:planId',
    authenticate,
    validate(planIdParamSchema, 'params'),
    validate(updatePlanSchema),
    updatePlanController(planService),
  );

  return router;
};
