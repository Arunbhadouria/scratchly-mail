import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Do not log tokens or sensitive data
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, message);
    if (status === 500 && err.stack) {
      console.error(err.stack);
    }
  }

  res.status(status).json({
    success: false,
    error: message,
    code: err.code || undefined,
    details: process.env.NODE_ENV === 'development' ? err.details || err.stack : undefined,
  });
}
