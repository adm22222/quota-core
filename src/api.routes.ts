import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.ts';

interface ApiRoutesDependencies {
  accountRoutes: Router;
}

export const createApiRoutes = ({ accountRoutes }: ApiRoutesDependencies) => {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/accounts', accountRoutes);

  return router;
};
