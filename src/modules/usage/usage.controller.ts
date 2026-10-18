import type { RequestHandler } from 'express';
import type { UsageService } from './usage.service.ts';
import { usageQuerySchema, userUsageQuerySchema } from './usage.schema.ts';

export const createUsageController =
  (service: UsageService): RequestHandler =>
  async (req, res, next) => {
    try {
      res
        .status(200)
        .json(
          await service.getUsage(
            req.account.id,
            usageQuerySchema.parse(req.query),
          ),
        );
    } catch (error) {
      next(error);
    }
  };

export const createUserUsageController =
  (service: UsageService): RequestHandler =>
  async (req, res, next) => {
    try {
      res
        .status(200)
        .json(
          await service.getUserUsage(
            req.account.id,
            req.params.userRef as string,
            userUsageQuerySchema.parse(req.query),
          ),
        );
    } catch (error) {
      next(error);
    }
  };
