import z from 'zod';

export const createConsume = z.object({
  userRef: z
    .string()
    .min(1, 'userRef is required')
    .max(128, 'userRef must not exceed 128 characters')
    .regex(
      /^[A-Za-z0-9._:@-]+$/,
      'userRef may only contain letters, digits, and the characters ._:@-',
    ),
  requestId: z.string().min(1).max(128),
  units: z.number().int().min(1).max(1_000_000_000),
});

export type CreateConsume = z.infer<typeof createConsume>;
