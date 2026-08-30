import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { db } from '../db/database';
import { requireRoles, require2FA } from '../middleware/auth';
import { logger } from '../middleware/logger';

const router = Router();

// 1. Live Collateral Positions
router.get('/positions', (req: Request, res: Response) => {
  const positions = db.getCollateralPositions();
  res.json({ positions });
});

// 2. Risk Evaluation Endpoint (Institutional Risk Matrix & Kelly Optimizer)
const riskEvalSchema = z.object({
  collateralValue: z.number().positive(),
  debt: z.number().nonnegative(),
  liquidationThreshold: z.number().min(0.5).max(1.0).default(0.85),
  expectedGrossReturn: z.number().default(0.12),
  borrowingCost: z.number().default(0.035),
  tradingFees: z.number().default(0.003),
  gasCost: z.number().default(0.001),
  slippage: z.number().default(0.002),
  protocolFees: z.number().default(0.001),
  volatility: z.number().default(0.45),
  maxDrawdownThreshold: z.number().default(0.15),
  capitalAtRisk: z.number().default(50000),
  totalPortfolioValue: z.number().positive().default(250000),
});

router.post('/evaluate', (req: Request, res: Response) => {
  const parse = riskEvalSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.flatten().fieldErrors });
  }

  const {
    collateralValue,
    debt,
    liquidationThreshold,
    expectedGrossReturn,
    borrowingCost,
    tradingFees,
    gasCost,
    slippage,
    protocolFees,
    volatility,
    capitalAtRisk,
    totalPortfolioValue,
  } = parse.data;

  const colDec = new Decimal(collateralValue);
  const debtDec = new Decimal(debt);
  const liqThreshDec = new Decimal(liquidationThreshold);

  const ltv = debtDec.dividedBy(colDec).toNumber();
  const healthFactor = debtDec.isZero() ? 999 : colDec.times(liqThreshDec).dividedBy(debtDec).toNumber();

  // Liquidation Price Drop % = (1 - (Debt / (Collateral * LiqThresh))) * 100
  const maxSafeDebt = colDec.times(liqThreshDec);
  const liquidationPriceDropPct = debtDec.greaterThan(maxSafeDebt)
    ? 0
    : new Decimal(1).minus(debtDec.dividedBy(maxSafeDebt)).times(100).toNumber();

  const totalCosts = borrowingCost + tradingFees + gasCost + slippage + protocolFees;
  const expectedNetReturn = expectedGrossReturn - totalCosts;
  const riskFreeRate = 0.04;
  const sharpeRatio = volatility > 0 ? (expectedNetReturn - riskFreeRate) / volatility : 0;

  // Conservative Half-Kelly: f* = (p*b - q)/b * 0.5 capped at 20%
  const winRate = 0.62;
  const profitRatio = 1.8;
  const lossRatio = 1.0;
  const rawKelly = (winRate * profitRatio - (1 - winRate) * lossRatio) / profitRatio;
  const conservativeKelly = Math.max(0, Math.min(0.20, rawKelly * 0.5));

  const exposureRatio = capitalAtRisk / totalPortfolioValue;

  let decision: 'APPROVED' | 'REJECTED' | 'REDUCE_POSITION' | 'CLOSE_POSITION' | 'EMERGENCY_STOP' = 'APPROVED';
  const reasons: string[] = [];

  if (healthFactor < 1.15) {
    decision = 'EMERGENCY_STOP';
    reasons.push(`CRITICAL: Health factor ${healthFactor.toFixed(4)} violates absolute minimum emergency floor (1.1500)`);
  } else if (healthFactor < 1.35) {
    decision = 'REDUCE_POSITION';
    reasons.push(`WARNING: Health factor ${healthFactor.toFixed(4)} is inside the defensive buffer zone (< 1.3500)`);
  }

  if (ltv > 0.78) {
    decision = decision === 'EMERGENCY_STOP' ? decision : 'REJECTED';
    reasons.push(`LTV ${(ltv * 100).toFixed(2)}% exceeds institutional ceiling of 78.00%`);
  }

  if (expectedNetReturn <= 0) {
    decision = 'REJECTED';
    reasons.push(`Expected net return ${(expectedNetReturn * 100).toFixed(2)}% is non-positive after subtracting borrowing, gas and slippage costs`);
  }

  if (exposureRatio > 0.30) {
    decision = decision === 'EMERGENCY_STOP' ? decision : 'REDUCE_POSITION';
    reasons.push(`Single position capital exposure ${(exposureRatio * 100).toFixed(1)}% exceeds institutional max portfolio limit (30.0%)`);
  }

  if (reasons.length === 0) {
    reasons.push('All quantitative risk bounds, liquidation safety cushions, and LTV constraints passed');
  }

  res.json({
    decision,
    reasons,
    metrics: {
      ltv: Math.round(ltv * 10000) / 10000,
      healthFactor: Math.round(healthFactor * 10000) / 10000,
      liquidationPriceDropPct: Math.round(liquidationPriceDropPct * 100) / 100,
      expectedNetReturn: Math.round(expectedNetReturn * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
      conservativeKellyFraction: Math.round(conservativeKelly * 1000) / 1000,
      exposureRatio: Math.round(exposureRatio * 1000) / 1000,
      estimatedTotalCostPct: Math.round(totalCosts * 10000) / 10000,
    },
    timestamp: new Date().toISOString(),
    evaluation_id: `RISK_EVAL_${Date.now()}`
  });
});

// 3. Security Circuit Breakers
router.get('/circuit-breakers', (req: Request, res: Response) => {
  const breakers = db.getCircuitBreakers();
  res.json({ breakers });
});

const toggleBreakerSchema = z.object({
  id: z.string(),
  twoFactorCode: z.string().optional()
});

router.post(
  '/circuit-breakers/toggle',
  requireRoles(['ADMIN', 'RISK_MANAGER']),
  require2FA,
  (req: Request, res: Response) => {
    const parse = toggleBreakerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.flatten().fieldErrors });
    }

    const { id } = parse.data;
    const user = req.user!;

    try {
      const updated = db.toggleCircuitBreaker(id, {
        id: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip || '127.0.0.1'
      });

      res.json({
        message: `Circuit breaker ${id} ${updated.is_tripped ? 'TRIPPED' : 'DISARMED'} successfully`,
        breaker: updated
      });
    } catch (e: any) {
      res.status(404).json({ error: 'NOT_FOUND', message: e.message });
    }
  }
);

// 4. Global Emergency Pause (Killswitch)
const emergencyPauseSchema = z.object({
  paused: z.boolean(),
  reason: z.string().min(5).max(255),
  twoFactorCode: z.string().optional()
});

let globalEmergencyPaused = false;

router.get('/emergency-status', (req: Request, res: Response) => {
  res.json({ isEmergencyPaused: globalEmergencyPaused });
});

router.post(
  '/emergency-pause',
  requireRoles(['ADMIN', 'RISK_MANAGER']),
  require2FA,
  (req: Request, res: Response) => {
    const parse = emergencyPauseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.flatten().fieldErrors });
    }

    const { paused, reason } = parse.data;
    const user = req.user!;
    globalEmergencyPaused = paused;

    db.recordAuditLogInternal({
      event_type: 'EMERGENCY_KILLSWITCH_TRIGGER',
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      ip_address: req.ip || '127.0.0.1',
      action: paused ? 'ACTIVATED_GLOBAL_EMERGENCY_KILLSWITCH' : 'DEACTIVATED_GLOBAL_EMERGENCY_KILLSWITCH',
      details_json: { reason, state: paused }
    });

    logger.security(`EMERGENCY KILLSWITCH ${paused ? 'ACTIVATED' : 'DISARMED'}`, {
      userId: user.id,
      userRole: user.role,
      reason
    });

    res.json({
      isEmergencyPaused: globalEmergencyPaused,
      message: `System emergency killswitch has been ${paused ? 'ACTIVATED (All execution paused)' : 'DEACTIVATED (Normal operations resumed)'}.`,
      timestamp: new Date().toISOString()
    });
  }
);

export default router;
