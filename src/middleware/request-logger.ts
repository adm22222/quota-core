import { randomUUID } from 'node:crypto';
import { logger } from '../shared/logger.ts';
import type { Request, Response } from 'express';
import { pinoHttp } from 'pino-http';

export const requestLogger = pinoHttp({
  logger,

  genReqId: () => randomUUID(),

  serializers: {
    req: (req: Request) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: Response) => ({
      statusCode: res.statusCode,
    }),
  },

  customLogLevel: (_req: Request, res: Response, err: Error | undefined) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
