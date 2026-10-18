import { z } from 'zod';

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must use YYYY-MM format')
  .optional();

const cursorSchema = z.string().min(1).optional();

export const usageQuerySchema = z.object({
  month: monthSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: cursorSchema,
});

export const userUsageQuerySchema = z.object({ month: monthSchema });

export type UsageQuery = z.infer<typeof usageQuerySchema>;
export type UserUsageQuery = z.infer<typeof userUsageQuerySchema>;
