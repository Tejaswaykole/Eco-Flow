import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req[target] = await schema.parseAsync(req[target]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
