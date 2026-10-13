import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors.ts';
import { mapPrismaError } from '../shared/prisma-error-mapper.ts';
import { logger } from '../shared/logger.ts';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const mappedError = mapPrismaError(err);

  if (mappedError instanceof AppError) {
    if (mappedError.status >= 500) {
      logger.error(
        { err: mappedError, code: mappedError.code },
        'Application error',
      );
    }

    return res.status(mappedError.status).json({
      success: false,
      message: mappedError.message,
      code: mappedError.code,
      ...(mappedError.details !== undefined && {
        details: mappedError.details,
      }),
    });
  }

  logger.error(
    {
      err:
        mappedError instanceof Error
          ? mappedError
          : new Error(String(mappedError)),
    },
    'Unhandled error',
  );

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
};
