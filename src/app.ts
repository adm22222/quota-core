import express, { type Express } from 'express';
import { errorMiddleware } from './middleware/error-handler.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { apiRoutes } from './container.ts';
import healthRoutes from './modules/health/health.routes.ts';
import { openApiDocument, swaggerUi } from './config/swagger.ts';

const app: Express = express();

app.use(requestLogger);
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use('/api/v1', apiRoutes);

app.use(errorMiddleware);

export default app;
