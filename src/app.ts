import express, { type Express } from 'express';
import appRoutes from './api.routes.ts';
import { errorMiddleware } from './middleware/error-handler.ts';
import { requestLogger } from './middleware/request-logger.ts';

const app: Express = express();

app.use(requestLogger);

app.use(express.json());

app.use('/api/v1/', appRoutes);

app.use(errorMiddleware);

export default app;
