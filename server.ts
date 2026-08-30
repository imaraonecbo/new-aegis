import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

import { config } from './server/config';
import { logger } from './server/middleware/logger';
import {
  helmetMiddleware,
  corsMiddleware,
  generalRateLimiter,
  inputSanitizer
} from './server/middleware/security';
import { optionalAuth } from './server/middleware/auth';
import { idempotencyMiddleware } from './server/middleware/idempotency';
import { db } from './server/db/database';

// Route Imports
import authRoutes from './server/routes/authRoutes';
import treasuryRoutes from './server/routes/treasuryRoutes';
import riskRoutes from './server/routes/riskRoutes';
import tradingRoutes from './server/routes/tradingRoutes';
import auditRoutes from './server/routes/auditRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = config.PORT;

  // 1. Trust proxy in cloud container environments
  app.set('trust proxy', 1);

  // 2. Global Security Headers & CORS
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // 3. Body Parsing & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Input Sanitization
  app.use(inputSanitizer);

  // 5. Rate Limiting on API endpoints
  app.use('/api', generalRateLimiter);

  // 6. Idempotency & Auth Context
  app.use('/api', idempotencyMiddleware);
  app.use('/api', optionalAuth);

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    const summary = db.getTreasurySummary();
    const breakers = db.getCircuitBreakers();
    const activeBreakers = breakers.filter(b => b.is_tripped).length;

    res.json({
      status: activeBreakers > 0 ? 'CIRCUIT_BREAKER_ACTIVE' : 'HEALTHY',
      service: 'AegisQuant Institutional DeFi Engine',
      version: '1.0.0-PROD_ENTERPRISE',
      environment: config.NODE_ENV,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      treasury_reserves: {
        total_reserve_usd: summary.totalReserveUsd,
        operating_usd: summary.operatingReserveUsd,
        risk_usd: summary.riskReserveUsd,
        cold_treasury_usd: summary.coreTreasuryUsd,
        reinvestment_usd: summary.strategyReinvestmentUsd
      },
      security: {
        rbac_active: true,
        audit_hash_chain: 'ACTIVE',
        rate_limiting: 'ACTIVE',
        circuit_breakers_tripped: activeBreakers
      }
    });
  });

  // Mount Feature API Routers
  app.use('/api/auth', authRoutes);
  app.use('/api/treasury', treasuryRoutes);
  app.use('/api/risk', riskRoutes);
  app.use('/api/trading', tradingRoutes);
  app.use('/api/quant', tradingRoutes);
  app.use('/api/audit', auditRoutes);

  // ----------------------------------------------------
  // HOURLY RECONCILIATION CRON INITIALIZER
  // ----------------------------------------------------
  setInterval(() => {
    try {
      const report = db.runReconciliationAudit('HOURLY_AUTOMATED_RECONCILIATION_CRON');
      logger.audit('Hourly ledger reconciliation completed', {
        reportId: report.id,
        isBalanced: report.is_balanced,
        discrepancy: report.discrepancy_usd
      });
    } catch (err: any) {
      logger.error('Error during automated hourly reconciliation cron', err);
    }
  }, 60 * 60 * 1000); // Hourly

  // ----------------------------------------------------
  // GLOBAL ERROR HANDLER
  // ----------------------------------------------------
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled Application Error', err, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(err.status || 500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred. This incident has been logged for security auditing.' 
        : err.message
    });
  });

  // ----------------------------------------------------
  // VITE & FRONTEND SPA SERVING
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[AegisQuant] Production SaaS & Quantitative Trading Engine listening on port ${PORT}`);
  });
}

startServer();
