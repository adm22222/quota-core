import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.ts';

interface ApiRoutesDependencies {
  accountRoutes: Router;
  planRoutes: Router;
  userRoutes: Router;
  consumeRoutes: Router;
  usageRoutes: Router;
  historyRoutes: Router;
  currentAccountRoutes: Router;
}

export const createApiRoutes = ({
  accountRoutes,
  planRoutes,
  userRoutes,
  consumeRoutes,
  usageRoutes,
  historyRoutes,
  currentAccountRoutes,
}: ApiRoutesDependencies) => {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/account', accountRoutes);
  router.use('/accounts', accountRoutes);
  router.use('/plans', planRoutes);
  router.use('/users', userRoutes);
  router.use('/consume', consumeRoutes);
  router.use('/account', currentAccountRoutes);
  router.use('/', usageRoutes);
  router.use('/history', historyRoutes);
  return router;
};
