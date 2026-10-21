import { z } from 'zod';

export const createUserSchema = z.object({
  userRef: z
    .string()
    .min(1, 'userRef is required')
    .max(128, 'userRef must not exceed 128 characters')
    .regex(
      /^[A-Za-z0-9._:@-]+$/,
      'userRef may only contain letters, digits, and the characters ._:@-',
    ),
  planId: z.string().uuid('planId must be a valid UUID').optional(),
});

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const userRefParamSchema = z.object({
  userRef: z
    .string()
    .min(1, 'userRef is required')
    .max(128, 'userRef must not exceed 128 characters'),
});

export const updateUserPlanSchema = z.object({
  planId: z.string().uuid('planId must be a valid UUID'),
});

export const userCursorSchema = z.string().min(1);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type UserRefParamInput = z.infer<typeof userRefParamSchema>;
export type UpdateUserPlanInput = z.infer<typeof updateUserPlanSchema>;
