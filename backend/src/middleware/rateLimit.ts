import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipInTest?: boolean;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.', skipInTest = false } = options;
  const hits = new Map<string, number[]>();

  // Periodically clean up stale entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const limiter = (req: Request, res: Response, next: NextFunction): void => {
    if (skipInTest && (process.env.NODE_ENV === 'test' || req.headers['x-test-bypass-ratelimit'] === 'true')) {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const timestamps = hits.get(ip) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (recentTimestamps.length >= max) {
      const oldestInWindow = recentTimestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message,
          retryAfter: retryAfterSec,
        },
      });
      return;
    }

    recentTimestamps.push(now);
    hits.set(ip, recentTimestamps);

    next();
  };

  limiter.reset = () => {
    hits.clear();
  };

  return limiter;
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes per IP
  message: 'Too many authentication attempts from this IP, please try again in 15 minutes.',
  skipInTest: true,
});

