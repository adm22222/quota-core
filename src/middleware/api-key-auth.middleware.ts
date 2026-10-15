import type { RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/auth.service.ts';
import { UnauthorizedError } from '../shared/errors.ts';

export const createAuthenticateMiddleware = (
  authService: AuthService,
): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const apiKey = req.header('X-API-Key');

      if (!apiKey) {
        throw new UnauthorizedError('Missing API key');
      }

      req.account = await authService.authenticateApiKey(apiKey);

      next();
    } catch (error) {
      next(error);
    }
  };
};
