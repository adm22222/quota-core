import type { RequestHandler } from 'express';
import type { CreateConsume } from './consume.schema.ts';
import type { ConsumeService } from './consumption.service.ts';

export const createConsumeController =
  (service: ConsumeService): RequestHandler<{}, unknown, CreateConsume> =>
  async (req, res, next) => {
    try {
      res.status(200).json(await service.consume(req.account.id, req.body));
    } catch (error) {
      next(error);
    }
  };
