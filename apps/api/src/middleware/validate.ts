import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError || err?.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: err.flatten ? err.flatten().fieldErrors : err.errors,
        });
        return;
      }
      next(err);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      next();
    } catch (err: any) {
      if (err instanceof ZodError || err?.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: err.flatten ? err.flatten().fieldErrors : err.errors,
        });
        return;
      }
      next(err);
    }
  };
}
