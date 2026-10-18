import type { PrismaClient } from '../../generated/prisma/client.ts';
import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import { z } from 'zod';
import { AppError, ConflictError } from '../../shared/errors.ts';
import { createUserRepository } from './users.repository.ts';
import type {
  CreateUserInput,
  ListUsersQueryInput,
  UpdateUserPlanInput,
} from './users.schema.ts';

const toUserResponse = (row: {
  externalUserId: string;
  createdAt: Date;
  userPlan: {
    id: string;
    name: string;
    scope: string;
    isPredefined: boolean;
    monthlyAllowance: number;
    maxPerRequest: number;
    createdAt: Date;
    updatedAt: Date;
  };
}) => ({
  userRef: row.externalUserId,
  plan: row.userPlan,
  createdAt: row.createdAt,
});

const userCursorSchema = z.string().min(1);

export const createUserService = (db: PrismaClient) => ({
  async createUser(accountId: string, data: CreateUserInput) {
    return db.$transaction(async (tx) => {
      const repository = createUserRepository(tx);

      let planId: string;
      if (data.planId) {
        const plan = await repository.findPlanByIdForAccount(
          data.planId,
          accountId,
        );
        if (!plan) {
          throw new AppError('PlanNotFound', 'Plan not found', 404);
        }
        if (plan.scope !== 'USER') {
          throw new AppError(
            'PlanScopeMismatch',
            'Plan scope must be USER',
            422,
          );
        }
        planId = plan.id;
      } else {
        const basicPlan = await repository.findBasicPlan();
        if (!basicPlan) {
          throw new AppError('BasicPlanNotFound', 'Basic plan not found', 500);
        }
        planId = basicPlan.id;
      }

      const existing = await repository.findUserByRef(accountId, data.userRef);
      if (existing) {
        throw new ConflictError(
          `A user with userRef "${data.userRef}" already exists in this account`,
        );
      }
      const user = await repository.createUser({
        accountId,
        userRef: data.userRef,
        planId,
      });
      return toUserResponse(user);
    });
  },
  async listUsers(accountId: string, query: ListUsersQueryInput) {
    const repository = createUserRepository(db);
    const rows = await repository.listUsers(accountId, {
      limit: query.limit,
      cursor: decodeCursor(query.cursor, userCursorSchema),
    });
    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasNextPage
      ? encodeCursor(items[items.length - 1]?.externalUserId)
      : null;
    return {
      items: items.map(toUserResponse),
      nextCursor,
    };
  },
  async getUserByRef(accountId: string, userRef: string) {
    const repository = createUserRepository(db);
    const user = await repository.findUserByRef(accountId, userRef);
    if (!user) {
      throw new AppError('UserNotFound', 'User not found', 404);
    }
    return toUserResponse(user);
  },
  async updateUserPlan(
    accountId: string,
    userRef: string,
    data: UpdateUserPlanInput,
  ) {
    return db.$transaction(async (tx) => {
      const repository = createUserRepository(tx);
      const user = await repository.findUserByRef(accountId, userRef);
      if (!user) {
        throw new AppError('UserNotFound', 'User not found', 404);
      }
      const plan = await repository.findPlanByIdForAccount(
        data.planId,
        accountId,
      );
      if (!plan) {
        throw new AppError('PlanNotFound', 'Plan not found', 404);
      }
      if (plan.scope !== 'USER') {
        throw new AppError('PlanScopeMismatch', 'Plan scope must be USER', 422);
      }
      const updated = await repository.updateUserPlan(
        accountId,
        userRef,
        plan.id,
      );
      return toUserResponse(updated);
    });
  },
});
