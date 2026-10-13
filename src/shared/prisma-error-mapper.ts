import { Prisma } from '../generated/prisma/client.ts';
import { ConflictError, NotFoundError } from './errors.js';

type PrismaErrorMapper = (error: Prisma.PrismaClientKnownRequestError) => Error;

const prismaErrorMap: Record<string, PrismaErrorMapper> = {
  P2002: () => new ConflictError('Resource already exists'),

  P2025: () => new NotFoundError('Resource not found'),
};

export const mapPrismaError = (error: unknown): Error => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapper = prismaErrorMap[error.code];

    if (mapper) {
      return mapper(error);
    }
  }

  return error instanceof Error ? error : new Error('Unknown error');
};
