import type { Prisma, PrismaClient } from '../generated/prisma/client.ts';

export interface TransactionManager {
  run<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export type RepositoryFactory<T> = (tx?: Prisma.TransactionClient) => T;

export const createTransactionManager = (
  db: PrismaClient,
): TransactionManager => ({
  run: (callback) => db.$transaction(callback),
});
