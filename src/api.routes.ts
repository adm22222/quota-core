import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.ts';

interface ApiRoutesDependencies {
  accountRoutes: Router;
  planRoutes: Router;
  userRoutes: Router;
  consumeRoutes: Router;
}

export const createApiRoutes = ({
  accountRoutes,
  planRoutes,
  userRoutes,
  consumeRoutes,
}: ApiRoutesDependencies) => {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/accounts', accountRoutes);
  router.use('/plans', planRoutes);
  router.use('/users', userRoutes);
  router.use('/consume', consumeRoutes);
  return router;
};
