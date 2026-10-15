import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
