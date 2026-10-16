import { z } from 'zod';

export const listPlansQuerySchema = z.object({
  scope: z.enum(['ACCOUNT', 'USER']).optional(),
});

export type ListPlansQueryInput = z.infer<typeof listPlansQuerySchema>;
