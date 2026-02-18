import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Zod 스키마 기반 요청 body 검증 미들웨어
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      res.status(400).json({
        success: false,
        error: '입력 검증 실패',
        details: errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Zod 스키마 기반 요청 query 검증 미들웨어
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      res.status(400).json({
        success: false,
        error: '쿼리 파라미터 검증 실패',
        details: errors,
      });
      return;
    }
    next();
  };
}
