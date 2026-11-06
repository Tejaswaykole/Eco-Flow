import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Zod schema validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Known application operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.constructor.name,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Unexpected unhandled system / database errors
  console.error(`[Unhandled Error] [ReqID: ${req.headers['x-request-id'] || 'none'}]:`, err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
    },
  });
}
