import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';

import { validate } from '../../src/middleware/validate.ts';
import { ValidationError } from '../../src/shared/errors.ts';

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().int().positive('Age must be a positive integer'),
  });

  const createRequest = (data: Record<string, unknown>) =>
    ({
      body: {},
      query: {},
      params: {},
      ...data,
    }) as unknown as Request;

  const runMiddleware = (
    schema: z.ZodType,
    source: 'body' | 'query' | 'params',
    req: Request,
  ) => {
    const next = vi.fn<(err?: unknown) => void>();
    const middleware = validate(schema, source);

    middleware(req, {} as Response, next as NextFunction);

    return next;
  };

  it('should validate request body successfully', () => {
    const data = {
      name: 'Adam',
      age: 30,
    };

    const req = createRequest({ body: data });
    const next = runMiddleware(schema, 'body', req);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual(data);
  });

  it('should return validation error for invalid request body', () => {
    const data = {
      name: '',
      age: -5,
    };

    const req = createRequest({ body: data });
    const next = runMiddleware(schema, 'body', req);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(ValidationError);
    if (!(error instanceof ValidationError)) {
      throw new Error('Expected ValidationError');
    }

    expect(error.message).toContain('name');
    expect(error.message).toContain('age');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
  it('should validate request query successfully', () => {
    const data = {
      name: 'Eve',
      age: 25,
    };
    const req = createRequest({ query: data });
    const next = runMiddleware(schema, 'query', req);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual(data);
  });
  it('should validate request params successfully', () => {
    const data = {
      name: 'Charlie',
      age: 35,
    };
    const req = createRequest({ params: data });
    const next = runMiddleware(schema, 'params', req);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(req.params).toEqual(data);
  });
});
