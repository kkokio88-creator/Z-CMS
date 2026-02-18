import { Request, Response, NextFunction, Router } from 'express';

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  createdAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private defaultTTL: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTTLSeconds: number = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000;
    // 만료 항목 자동 정리 (TTL의 2배 간격)
    this.cleanupTimer = setInterval(() => this.purgeExpired(), this.defaultTTL * 2);
  }

  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store) {
      if (now - entry.createdAt > this.defaultTTL) {
        this.store.delete(key);
        purged++;
      }
    }
    if (purged > 0) {
      console.log(`[Cache] ${purged}개 만료 항목 정리 (남은 ${this.store.size}건)`);
    }
  }

  get(key: string): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.defaultTTL) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    this.store.set(key, entry);
  }

  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  getStats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (now - entry.createdAt > this.defaultTTL) {
        expired++;
      } else {
        valid++;
      }
    }
    return { total: this.store.size, valid, expired, ttlSeconds: this.defaultTTL / 1000 };
  }
}

export const cache = new MemoryCache(300); // 5분 TTL

export function cacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const key = req.originalUrl;
  const cached = cache.get(key);

  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.status(cached.statusCode).json(cached.data);
    return;
  }

  // 원본 json 메서드를 오버라이드하여 응답을 캐시에 저장
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, {
        data: body,
        headers: {},
        statusCode: res.statusCode,
        createdAt: Date.now(),
      });
      res.setHeader('X-Cache', 'MISS');
    }
    return originalJson(body);
  } as any;

  next();
}

export function createCacheRoutes(): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      cache: cache.getStats(),
    });
  });

  router.post('/clear', (_req, res) => {
    cache.clear();
    res.json({ success: true, message: '캐시가 초기화되었습니다.' });
  });

  return router;
}
