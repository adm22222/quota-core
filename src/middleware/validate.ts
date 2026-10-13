import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../shared/errors.ts';

type RequestSource = 'body' | 'query' | 'params';

export const validate = <T>(
  schema: ZodType<T>,
  source: RequestSource = 'body',
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));

      return next(
        new ValidationError(
          `Validation failed for field: ${details
            .map((detail) => detail.field)
            .join(', ')}`,
          details,
        ),
      );
    }

    if (source === 'body') {
      req.body = result.data;
    }

    next();
  };
};
