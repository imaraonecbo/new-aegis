import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { logger } from './logger';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  // Only apply to state-modifying requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  if (!idempotencyKey) {
    // If no key provided on financial write endpoints, require it
    if (req.path.includes('/treasury/deposit') || req.path.includes('/treasury/withdraw') || req.path.includes('/treasury/route-profits')) {
      return res.status(400).json({
        error: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Financial transactions must provide a unique Idempotency-Key header to prevent double-spending.'
      });
    }
    return next();
  }

  // Check if idempotency record exists
  const existing = db.getIdempotencyRecord(idempotencyKey);
  if (existing) {
    logger.audit('Replaying idempotent cached response', { idempotencyKey, endpoint: req.originalUrl });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(existing.response_status).json(existing.response_body);
  }

  // Intercept json send to record result
  const originalJson = res.json.bind(res);
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

  res.json = function (body: any) {
    // Only cache successful or intentional 4xx responses
    if (res.statusCode < 500) {
      db.saveIdempotencyRecord({
        idempotency_key: idempotencyKey,
        endpoint: req.originalUrl,
        request_hash: requestHash,
        response_status: res.statusCode,
        response_body: body,
        user_id: req.user?.id || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour TTL
        created_at: new Date().toISOString()
      });
    }
    return originalJson(body);
  };

  next();
}
