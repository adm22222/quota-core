import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

type ApiKeyDb = PrismaClient | Prisma.TransactionClient;

export interface AuthenticatedAccount {
  id: string;
  name: string;
}

export interface ApiKeyRepository {
  findAccountByKeyHash(hash: string): Promise<AuthenticatedAccount | null>;

  saveKey(data: {
    accountId: string;
    keyHash: string;
    keyPrefix: string;
  }): Promise<void>;
}

export const createApiKeyRepository = (db: ApiKeyDb): ApiKeyRepository => ({
  async saveKey({ accountId, keyHash, keyPrefix }) {
    await db.apiKey.create({
      data: {
        accountId,
        keyHash,
        keyPrefix,
      },
    });
  },

  async findAccountByKeyHash(hash) {
    const result = await db.apiKey.findUnique({
      where: {
        keyHash: hash,
      },
      select: {
        account: {
          select: {
            id: true,
            name: true,
            accountPlan: true,
            createdAt: true,
          },
        },
      },
    });

    return result?.account ?? null;
  },
});
