import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.ts';

const router = Router();

router.use('/health', healthRoutes);

export default router;
