import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireRoles } from '../middleware/auth';

const router = Router();

// GET /api/audit/logs (Audit Trail Explorer)
router.get('/logs', (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const eventType = typeof req.query.event_type === 'string' ? req.query.event_type : undefined;
  
  const logs = db.getAuditLogs(limit, eventType);
  res.json({ logs, total: logs.length });
});

// GET /api/audit/verify-chain (Cryptographic Proof Verification)
router.get('/verify-chain', (req: Request, res: Response) => {
  const verification = db.verifyAuditChainIntegrity();
  
  res.json({
    status: verification.isValid ? 'CHAIN_INTEGRITY_VERIFIED' : 'CHAIN_TAMPERED',
    is_valid: verification.isValid,
    records_verified: verification.verifiedCount,
    broken_at_id: verification.brokenAtId,
    hash_algorithm: 'HMAC-SHA256 Chained Hashes',
    verified_at: new Date().toISOString()
  });
});

export default router;
