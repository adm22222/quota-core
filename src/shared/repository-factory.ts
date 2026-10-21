import type { Prisma, PrismaClient } from '../generated/prisma/client.ts';
import { prisma } from './prisma.ts';

type DbClient = PrismaClient | Prisma.TransactionClient;
export const createRepositoryFactory = <T>(
  createRepository: (db: DbClient) => T,
) => {
  return (tx?: DbClient): T => createRepository(tx ?? prisma);
};
