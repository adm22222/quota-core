import { ValidationError } from '../shared/errors.ts';
import type { ZodType } from 'zod';

export const encodeCursor = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

export const decodeCursor = <T>(
  value: string | undefined,
  schema: ZodType<T>,
) => {
  if (!value) return undefined;
  try {
    return schema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
  } catch {
    throw new ValidationError('Invalid cursor');
  }
};
