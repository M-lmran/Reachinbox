import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { fail } from '../utils/response';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): Response {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err: err.message, path: req.path }, 'Handled server error');
    }
    return fail(res, err.statusCode, err.message, err.code, err.details);
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  logger.error({ err: message, path: req.path }, 'Unhandled error');
  return fail(
    res,
    500,
    env.NODE_ENV === 'production' ? 'Internal server error' : message,
    'INTERNAL_ERROR',
  );
}

export function notFoundHandler(_req: Request, res: Response): Response {
  return fail(res, 404, 'Route not found', 'NOT_FOUND');
}
