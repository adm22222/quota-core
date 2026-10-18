import { z } from 'zod';

export const historyQuerySchema = z.object({
  userRef: z.string().min(1).max(128).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  outcome: z.enum(['ACCEPTED', 'REJECTED']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
