import { z } from 'zod';

export const listPlansQuerySchema = z.object({
  scope: z.enum(['ACCOUNT', 'USER']).optional(),
});

export const planIdParamSchema = z.object({
  planId: z.string().uuid('Plan ID must be a valid UUID'),
});

export type ListPlansQueryInput = z.infer<typeof listPlansQuerySchema>;
export type PlanIdParamInput = z.infer<typeof planIdParamSchema>;
