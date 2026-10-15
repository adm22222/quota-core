import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
});

export const updateAccountPlanSchema = z.object({
  planId: z.string().uuid('Plan ID must be a valid UUID'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountPlanInput = z.infer<typeof updateAccountPlanSchema>;
