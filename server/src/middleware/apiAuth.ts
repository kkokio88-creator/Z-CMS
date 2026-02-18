import { Request, Response, NextFunction } from 'express';

/**
 * API 키 인증 미들웨어
 * 환경변수 API_SECRET_KEY가 설정된 경우에만 활성화
 * 설정하지 않으면 인증 없이 통과 (개발 환경 호환)
 */
export function apiAuth(req: Request, res: Response, next: NextFunction): void {
  const secretKey = process.env.API_SECRET_KEY;

  // API_SECRET_KEY 미설정 시 인증 건너뜀 (개발 환경)
  if (!secretKey) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'] as string | undefined;

  if (!providedKey || providedKey !== secretKey) {
    res.status(401).json({
      success: false,
      error: '인증 실패: 유효한 API 키가 필요합니다.',
    });
    return;
  }

  next();
}
