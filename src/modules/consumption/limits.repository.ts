import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

import type { PlanLimits } from '../rules/rule.types.ts';

export interface LimitRepository {
  findUser(
    accountId: string,
    userRef: string,
  ): Promise<{
    id: string;
    accountPlan: { id: string; name: string } & PlanLimits;
    userPlan: { id: string; name: string } & PlanLimits;
  } | null>;
  findUserId(
    accountId: string,
    externalUserId: string,
  ): Promise<{
    id: string;
  } | null>;
}
export const createLimitRepository = (
  db: PrismaClient | Prisma.TransactionClient,
): LimitRepository => ({
  async findUser(accountId, externalUserId) {
    return db.user
      .findUnique({
        where: {
          accountId_externalUserId: { accountId, externalUserId },
        },
        select: {
          id: true,
          account: {
            select: {
              accountPlan: {
                select: {
                  id: true,
                  name: true,
                  monthlyAllowance: true,
                  maxPerRequest: true,
                },
              },
            },
          },
          userPlan: {
            select: {
              id: true,
              name: true,
              monthlyAllowance: true,
              maxPerRequest: true,
            },
          },
        },
      })
      .then(
        (row) =>
          row && {
            id: row.id,
            accountPlan: row.account.accountPlan,
            userPlan: row.userPlan,
          },
      );
  },
  async findUserId(accountId: string, externalUserId: string) {
    return db.user.findUnique({
      where: { accountId_externalUserId: { accountId, externalUserId } },
      select: { id: true },
    });
  },
});
