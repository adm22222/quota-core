export class AppError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, statusCode: number = 500) {
    super(message);
    this.status = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Bad request') {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND_ERROR', message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED_ERROR', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN_ERROR', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super('CONFLICT_ERROR', message, 409);
  }
}

export class unprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable Entity') {
    super('UNPROCESSABLE_ENTITY_ERROR', message, 422);
  }
}
