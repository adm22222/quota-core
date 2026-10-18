import type { RequestHandler } from 'express';
import type { HistoryService } from './history.service.ts';
import { historyQuerySchema } from './history.schema.ts';

export const createHistoryController =
  (service: HistoryService): RequestHandler =>
  async (req, res, next) => {
    try {
      res
        .status(200)
        .json(
          await service.getHistory(
            req.account.id,
            historyQuerySchema.parse(req.query),
          ),
        );
    } catch (error) {
      next(error);
    }
  };
