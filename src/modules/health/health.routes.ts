import express, { type Express, type Request, type Response } from 'express';

const healthRoutes: Express = express();

healthRoutes.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default healthRoutes;
