import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from './logger';

// 1. Helmet Security Headers (Configured for Cloud Run Container & AI Studio iframe preview)
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Allow Vite dev scripts, styles, and iframe embedding in preview
  frameguard: false, // Allow AI Studio iframe preview container
  crossOriginEmbedderPolicy: false,
  hsts: false
});

// 2. CORS (Configured to allow web client and preview containers)
export const corsMiddleware = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'Idempotency-Key',
    'X-2FA-Code',
    'X-Requested-With'
  ],
  exposedHeaders: ['Idempotency-Key', 'X-Audit-Hash']
});

// 3. Rate Limiters
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Rate limit exceeded: Maximum 120 requests per minute per IP address.'
  },
  handler: (req, res, next, options) => {
    logger.security('Rate limit exceeded on general API', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts from this IP. Please wait 15 minutes before retrying.'
  },
  handler: (req, res, next, options) => {
    logger.security('Auth rate limit exceeded', { ip: req.ip, email: req.body?.email });
    res.status(429).json(options.message);
  }
});

export const financialTxRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 financial transfers/routing calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TRANSACTION_RATE_LIMIT_EXCEEDED',
    message: 'Financial transaction rate limit exceeded. Please wait 60 seconds.'
  }
});

// 4. Input Sanitizer Middleware (Deep string sanitizer)
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Strip control characters and script injection vectors
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, (char) => (char === '<' ? '&lt;' : '&gt;'))
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitizedObj[key] = sanitizeValue(value[key]);
    }
    return sanitizedObj;
  }
  return value;
}

export function inputSanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  next();
}
