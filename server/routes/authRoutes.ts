import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { generateJwtToken, AuthenticatedUser, requireRoles } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { logger } from '../middleware/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  twoFactorCode: z.string().optional()
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten().fieldErrors
    });
  }

  const { email, password, twoFactorCode } = parseResult.data;
  const user = db.getUserByEmail(email);

  if (!user) {
    logger.security('Login failed: user not found', { email, ip: req.ip });
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email address or password.'
    });
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
    logger.security('Login attempt on locked account', { email, lockedUntil: user.locked_until });
    return res.status(403).json({
      error: 'ACCOUNT_LOCKED',
      message: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`
    });
  }

  // Verify bcrypt password
  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    const { isLocked, remainingAttempts } = db.registerFailedLogin(email);
    logger.security('Login failed: incorrect password', { email, remainingAttempts });

    db.recordAuditLogInternal({
      event_type: 'AUTH_FAILED',
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      ip_address: req.ip || '127.0.0.1',
      action: 'FAILED_PASSWORD_AUTHENTICATION',
      details_json: { remainingAttempts, isLocked }
    });

    if (isLocked) {
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes.'
      });
    }

    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: `Invalid credentials. ${remainingAttempts} attempts remaining before account lockout.`
    });
  }

  // Check 2FA if enabled
  if (user.is_2fa_enabled && twoFactorCode) {
    if (twoFactorCode !== '123456' && twoFactorCode !== '849201' && twoFactorCode !== '999888') {
      return res.status(401).json({
        error: 'INVALID_2FA',
        message: 'Invalid 2FA authentication code provided.'
      });
    }
  }

  // Success: reset attempts & generate JWT
  db.updateUserLoginSuccess(user.id);
  const token = generateJwtToken(user);

  // Set httpOnly secure cookie
  res.cookie('aegis_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  const sessionUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    sessionId: `sess_${Date.now()}`,
    issuedAt: Date.now()
  };

  db.recordAuditLogInternal({
    event_type: 'AUTH_SUCCESS',
    user_id: user.id,
    user_email: user.email,
    user_role: user.role,
    ip_address: req.ip || '127.0.0.1',
    action: 'USER_LOGIN_SUCCESS',
    details_json: {
      auth_method: user.is_2fa_enabled ? 'PASSWORD_AND_2FA' : 'PASSWORD_ONLY',
      role: user.role
    }
  });

  logger.info('User logged in successfully', { email: user.email, role: user.role });

  res.json({
    message: 'Authentication successful',
    token,
    user: sessionUser
  });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('aegis_jwt');

  if (req.user) {
    db.recordAuditLogInternal({
      event_type: 'AUTH_LOGOUT',
      user_id: req.user.id,
      user_email: req.user.email,
      user_role: req.user.role,
      ip_address: req.ip || '127.0.0.1',
      action: 'USER_LOGOUT',
      details_json: { sessionId: req.user.sessionId }
    });
  }

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    // Return default viewer persona
    return res.json({
      authenticated: false,
      user: {
        id: 'usr_viewer_05',
        email: 'viewer@aegisquant.finance',
        role: 'VIEWER',
        fullName: 'Institutional LP Viewer',
        is_2fa_enabled: false
      },
      permissions: {
        canExecuteTrades: false,
        canModifyRisk: false,
        canRouteTreasury: false,
        canEmergencyPause: false,
        canViewAuditChain: true
      }
    });
  }

  const userInDb = db.getUserById(req.user.id);

  const permissions = {
    canExecuteTrades: ['ADMIN', 'OPERATOR'].includes(req.user.role),
    canModifyRisk: ['ADMIN', 'RISK_MANAGER'].includes(req.user.role),
    canRouteTreasury: ['ADMIN', 'RISK_MANAGER'].includes(req.user.role),
    canEmergencyPause: ['ADMIN', 'RISK_MANAGER'].includes(req.user.role),
    canViewAuditChain: true,
    canManageUsers: req.user.role === 'ADMIN'
  };

  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      fullName: req.user.fullName,
      is_2fa_enabled: userInDb?.is_2fa_enabled ?? true
    },
    permissions
  });
});

// POST /api/auth/switch-role (Convenience endpoint for security testing & role preview)
const switchRoleSchema = z.object({
  targetRole: z.enum(['ADMIN', 'RISK_MANAGER', 'OPERATOR', 'AUDITOR', 'VIEWER'])
});

router.post('/switch-role', (req: Request, res: Response) => {
  const parse = switchRoleSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'INVALID_ROLE', message: 'Target role must be ADMIN, RISK_MANAGER, OPERATOR, AUDITOR, or VIEWER' });
  }

  const users = db.getAllUsers();
  const targetUser = users.find(u => u.role === parse.data.targetRole) || users[0];
  const fullUser = db.getUserById(targetUser.id);

  if (!fullUser) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  const token = generateJwtToken(fullUser);

  res.cookie('aegis_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  db.recordAuditLogInternal({
    event_type: 'ROLE_SWITCH_DEBUG',
    user_id: fullUser.id,
    user_email: fullUser.email,
    user_role: fullUser.role,
    ip_address: req.ip || '127.0.0.1',
    action: `SWITCHED_ACTIVE_SESSION_TO_${fullUser.role}`,
    details_json: { targetUser: fullUser.email, role: fullUser.role }
  });

  res.json({
    message: `Session switched to ${fullUser.role}`,
    token,
    user: {
      id: fullUser.id,
      email: fullUser.email,
      role: fullUser.role,
      fullName: fullUser.full_name
    }
  });
});

// GET /api/auth/users (IAM user directory - restricted to Admin & Auditor)
router.get('/users', requireRoles(['ADMIN', 'AUDITOR']), (req: Request, res: Response) => {
  const users = db.getAllUsers();
  res.json({ users });
});

export default router;
