export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: unknown,
  ) {
    super(message);

    this.name = this.constructor.name;
    this.status = statusCode;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND_ERROR', message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED_ERROR', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN_ERROR', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT_ERROR', message, 409, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity', details?: unknown) {
    super('UNPROCESSABLE_ENTITY_ERROR', message, 422, details);
  }
}
