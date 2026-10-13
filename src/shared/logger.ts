import pino, { type Logger } from 'pino';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'api_key',
      'req.headers.x-api-key',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});
