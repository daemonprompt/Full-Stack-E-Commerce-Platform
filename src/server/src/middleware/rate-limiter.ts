import rateLimit from 'express-rate-limit';

/**
 * Default API rate limiter — 100 requests per 15 minutes per IP.
 * Applied to all /api/v1/* routes.
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests. Please try again later.',
  },
});

/**
 * Auth endpoint rate limiter — 10 attempts per 15 minutes per IP.
 * Applied to /api/v1/auth/* routes.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Order write rate limiter — 30 order modifications per 10 minutes per IP.
 * Applied to POST/PATCH/DELETE on /api/v1/orders/*.
 */
export const orderWriteRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Order modification rate limit exceeded.',
  },
});
