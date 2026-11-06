import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200, meta?: any): void {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message && { message }),
    data,
    ...(meta && { meta }),
  };
  res.status(statusCode).json(payload);
}

export function sendCreated<T>(res: Response, data: T, message = 'Resource created successfully'): void {
  sendSuccess(res, data, message, 201);
}
