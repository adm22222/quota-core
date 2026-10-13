import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors.ts';
import { mapPrismaError } from '../shared/prisma-error-mapper.ts';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const mappedError = mapPrismaError(err);

  if (mappedError instanceof AppError) {
    return res.status(mappedError.status).json({
      success: false,
      message: mappedError.message,
      code: mappedError.code,
      ...(mappedError.details !== undefined && {
        details: mappedError.details,
      }),
    });
  }

  console.error(mappedError);

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
};
