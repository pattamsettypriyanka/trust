import rateLimit from 'express-rate-limit';

// General API rate limiter: 300 requests per 5 minutes per IP
export const apiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://trustvault.internal/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Rate limit exceeded. Please try again after a few minutes.'
  }
});

// Stricter rate limiter for sensitive authentication & permission operations: 60 requests per minute
export const sensitiveOpsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://trustvault.internal/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Rate limit exceeded for sensitive operations. Slow down your requests.'
  }
});
