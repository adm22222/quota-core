import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  scope: z.enum(['ACCOUNT', 'USER'], {
    message: 'Scope must be ACCOUNT or USER',
  }),
  monthlyAllowance: z
    .number()
    .int('Monthly allowance must be an integer')
    .min(1, 'Monthly allowance must be at least 1')
    .max(1_000_000_000, 'Monthly allowance must not exceed 1,000,000,000'),
  maxPerRequest: z
    .number()
    .int('Max per request must be an integer')
    .min(1, 'Max per request must be at least 1')
    .max(1_000_000_000, 'Max per request must not exceed 1,000,000,000'),
});

export const updatePlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  monthlyAllowance: z
    .number()
    .int('Monthly allowance must be an integer')
    .min(1, 'Monthly allowance must be at least 1')
    .max(1_000_000_000, 'Monthly allowance must not exceed 1,000,000,000'),
  maxPerRequest: z
    .number()
    .int('Max per request must be an integer')
    .min(1, 'Max per request must be at least 1')
    .max(1_000_000_000, 'Max per request must not exceed 1,000,000,000'),
});

export const listPlansQuerySchema = z.object({
  scope: z.enum(['ACCOUNT', 'USER']).optional(),
});

export const planIdParamSchema = z.object({
  planId: z.string().uuid('Plan ID must be a valid UUID'),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ListPlansQueryInput = z.infer<typeof listPlansQuerySchema>;
export type PlanIdParamInput = z.infer<typeof planIdParamSchema>;
