import { decodeCursor, encodeCursor } from '../../helpers/cursor.ts';
import { z } from 'zod';
import { AppError, ConflictError } from '../../shared/errors.ts';
import { createUserRepository } from './users.repository.ts';
import type {
  RepositoryFactory,
  TransactionManager,
} from '../../shared/transaction-manager.ts';
import {
  userCursorSchema,
  type CreateUserInput,
  type ListUsersQueryInput,
  type UpdateUserPlanInput,
} from './users.schema.ts';
import type { UserRow } from './users.types.ts';

const toUserResponse = (row: UserRow) => ({
  userRef: row.externalUserId,
  plan: row.userPlan,
  createdAt: row.createdAt,
});

type UserRepository = ReturnType<typeof createUserRepository>;

export const createUserService = (deps: {
  userRepositoryFactory: RepositoryFactory<UserRepository>;
  transactionManager: TransactionManager;
}) => ({
  async createUser(accountId: string, data: CreateUserInput) {
    return deps.transactionManager.run(async (tx) => {
      const repository = deps.userRepositoryFactory(tx);

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
    const repository = deps.userRepositoryFactory();
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
    const repository = deps.userRepositoryFactory();
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
    return deps.transactionManager.run(async (tx) => {
      const repository = deps.userRepositoryFactory(tx);
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
