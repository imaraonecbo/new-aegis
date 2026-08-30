import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, UserRow } from '../db/database';
import { logger } from './logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'RISK_MANAGER' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
  fullName: string;
  sessionId: string;
  issuedAt: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateJwtToken(user: UserRow): string {
  const payload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    issuedAt: Date.now()
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any
  });
}

// Authentication extraction middleware (Supports cookies & Bearer Authorization header)
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check httpOnly cookie
  if (req.cookies && req.cookies.aegis_jwt) {
    token = req.cookies.aegis_jwt;
  }

  // 2. Check Authorization Bearer header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token is required. Please log in.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthenticatedUser;

    // Check session inactivity timeout (15 minutes default)
    const sessionAgeMinutes = (Date.now() - decoded.issuedAt) / (1000 * 60);
    if (sessionAgeMinutes > config.SESSION_TIMEOUT_MINUTES) {
      logger.security('Session expired due to inactivity timeout', { userId: decoded.id, sessionAgeMinutes });
      return res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'Your session has expired due to inactivity. Please log in again.'
      });
    }

    // Verify user still exists in database and is not locked
    const userInDb = db.getUserById(decoded.id);
    if (!userInDb) {
      return res.status(401).json({ error: 'USER_NOT_FOUND', message: 'User account no longer exists.' });
    }

    if (userInDb.locked_until && new Date(userInDb.locked_until).getTime() > Date.now()) {
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: `Account is locked due to consecutive security triggers until ${userInDb.locked_until}`
      });
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    logger.security('Invalid JWT token received', { error: err.message, ip: req.ip });
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Authentication token is invalid or expired.'
    });
  }
}

// Optional Auth (For public read routes that can upgrade permissions if logged in)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  if (req.cookies && req.cookies.aegis_jwt) {
    token = req.cookies.aegis_jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignore token error for optional auth
    }
  }

  // Default to system viewer if not logged in
  if (!req.user) {
    req.user = {
      id: 'usr_viewer_05',
      email: 'viewer@aegisquant.finance',
      role: 'VIEWER',
      fullName: 'Institutional LP Viewer',
      sessionId: 'sess_default_viewer',
      issuedAt: Date.now()
    };
  }

  next();
}

// RBAC Role Enforcement Middleware
export function requireRoles(allowedRoles: Array<'ADMIN' | 'RISK_MANAGER' | 'OPERATOR' | 'AUDITOR' | 'VIEWER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Access Denied: Insufficient RBAC Permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });

      db.recordAuditLogInternal({
        event_type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        user_id: req.user.id,
        user_email: req.user.email,
        user_role: req.user.role,
        ip_address: req.ip || '127.0.0.1',
        action: `FORBIDDEN_ATTEMPT_${req.method}_${req.path}`,
        details_json: {
          required_roles: allowedRoles,
          attempted_url: req.originalUrl
        }
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Your role (${req.user.role}) is not authorized to perform this operation. Required: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
}

// 2FA / TOTP Check for Sensitive Operations (e.g. emergency pause, withdrawals, profit distributions)
export function require2FA(req: Request, res: Response, next: NextFunction) {
  const code = (req.headers['x-2fa-code'] as string) || req.body?.twoFactorCode || req.body?.otp;

  // In production, verify TOTP token against user secret
  // Accept standard 6-digit TOTP format (or '123456' in development test mode)
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(403).json({
      error: '2FA_REQUIRED',
      message: 'High-security financial action requires a valid 6-digit TOTP 2FA code in X-2FA-Code header or twoFactorCode field.'
    });
  }

  // Verify code
  if (code !== '123456' && code !== '849201' && code !== '999888') {
    // In demo environment, 123456, 849201, 999888 are valid simulated TOTP hardware tokens
    logger.security('Invalid 2FA TOTP Attempt', { userId: req.user?.id, attemptedCode: code });
    return res.status(403).json({
      error: 'INVALID_2FA_CODE',
      message: 'The provided 6-digit Two-Factor Authentication code is invalid or has expired.'
    });
  }

  next();
}
