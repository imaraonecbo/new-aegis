import crypto from 'crypto';
import Decimal from 'decimal.js';
import bcrypt from 'bcryptjs';

// Configure Decimal precision (36 significant digits, 18 decimal places for crypto math)
Decimal.set({ precision: 36, rounding: Decimal.ROUND_HALF_UP });

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'ADMIN' | 'RISK_MANAGER' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
  full_name: string;
  totp_secret?: string;
  is_2fa_enabled: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreasuryReserveRow {
  id: string;
  bucket_type: 'OPERATING' | 'INSURANCE_RISK' | 'COLD_TREASURY' | 'REINVESTMENT';
  token_symbol: string;
  balance: string; // Stored as exact Decimal string
  target_percentage: number;
  contract_vault_address: string;
  blockchain: string;
  last_reconciled_at: string;
  updated_at: string;
}

export interface TreasuryLedgerRow {
  id: string;
  tx_hash: string;
  idempotency_key: string | null;
  bucket_from: string;
  bucket_to: string;
  token_symbol: string;
  token_amount: string; // Exact Decimal string
  usd_value: string; // Exact Decimal string
  balance_before_usd: string;
  balance_after_usd: string;
  memo: string;
  auth_policy: string;
  performed_by_user_id: string | null;
  blockchain: string;
  block_number: number;
  created_at: string;
}

export interface CollateralPositionRow {
  id: string;
  protocol: string;
  blockchain: string;
  collateral_asset: string;
  collateral_amount: string;
  collateral_price_usd: string;
  borrowed_asset: string;
  borrowed_amount: string;
  borrowed_price_usd: string;
  liquidation_threshold: number;
  borrow_apr_pct: number;
  supply_apy_pct: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL_DEFENSE' | 'LIQUIDATION_RISK';
  updated_at: string;
}

export interface QuantStrategyRow {
  id: string;
  name: string;
  category: 'DELTA_NEUTRAL_ARBITRAGE' | 'COLLATERALIZED_YIELD_FARM' | 'CROSS_DEX_LIQUIDITY_REBALANCE' | 'VOLATILITY_HARVEST';
  target_protocol: string;
  status: 'ACTIVE' | 'PAUSED' | 'SIMULATING' | 'GOVERNANCE_REVIEW';
  allocated_capital_usd: string;
  max_leverage: number;
  max_ltv: number;
  min_health_factor: number;
  current_sharpe: number;
  current_sortino: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  total_pnl_usd: string;
  last_simulated_return_pct: number;
  updated_at: string;
}

export interface CircuitBreakerRow {
  id: string;
  name: string;
  trigger_condition: string;
  current_metric: string;
  is_tripped: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_tripped_at: string | null;
  last_checked_at: string;
}

export interface AuditLogRow {
  id: number;
  event_uuid: string;
  event_type: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string;
  ip_address: string;
  user_agent: string | null;
  action: string;
  details_json: Record<string, any>;
  prev_hash: string;
  current_hash: string;
  created_at: string;
}

export interface IdempotencyRow {
  idempotency_key: string;
  endpoint: string;
  request_hash: string;
  response_status: number;
  response_body: any;
  user_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface ReconciliationReportRow {
  id: string;
  total_ledger_inflows_usd: string;
  total_ledger_outflows_usd: string;
  expected_net_balance_usd: string;
  actual_reserves_balance_usd: string;
  discrepancy_usd: string;
  is_balanced: boolean;
  audited_by: string;
  created_at: string;
}

class AegisProductionDatabase {
  private users: Map<string, UserRow> = new Map();
  private reserves: Map<string, TreasuryReserveRow> = new Map();
  private ledger: TreasuryLedgerRow[] = [];
  private positions: Map<string, CollateralPositionRow> = new Map();
  private strategies: Map<string, QuantStrategyRow> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerRow> = new Map();
  private auditLogs: AuditLogRow[] = [];
  private idempotencyStore: Map<string, IdempotencyRow> = new Map();
  private reconciliationReports: ReconciliationReportRow[] = [];
  private lastAuditHash: string = '0000000000000000000000000000000000000000000000000000000000000000';
  private initialized: boolean = false;

  constructor() {
    this.seedInitialProductionState();
  }

  private seedInitialProductionState() {
    if (this.initialized) return;

    // 1. IAM Initial Enterprise Users
    const salt = bcrypt.genSaltSync(12);
    const adminPasswordHash = bcrypt.hashSync('AegisAdmin2026!Secure', salt);
    const riskManagerPasswordHash = bcrypt.hashSync('RiskManager2026!Sec', salt);
    const auditorPasswordHash = bcrypt.hashSync('Auditor2026!Verify', salt);
    const operatorPasswordHash = bcrypt.hashSync('Operator2026!Execute', salt);
    const viewerPasswordHash = bcrypt.hashSync('Viewer2026!Read', salt);

    const defaultUsers: UserRow[] = [
      {
        id: 'usr_admin_01',
        email: 'admin@aegisquant.finance',
        password_hash: adminPasswordHash,
        role: 'ADMIN',
        full_name: 'Dr. Evelyn Vance (Chief Risk & System Architect)',
        totp_secret: 'JBSWY3DPEHPK3PXP', // Sample TOTP Base32 secret for 2FA demonstration
        is_2fa_enabled: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'usr_risk_02',
        email: 'risk@aegisquant.finance',
        password_hash: riskManagerPasswordHash,
        role: 'RISK_MANAGER',
        full_name: 'Marcus Chen (Principal Quantitative Risk Officer)',
        totp_secret: 'JBSWY3DPEHPK3PXP',
        is_2fa_enabled: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'usr_operator_03',
        email: 'operator@aegisquant.finance',
        password_hash: operatorPasswordHash,
        role: 'OPERATOR',
        full_name: 'Siddharth Rao (Execution & MEV Specialist)',
        totp_secret: 'JBSWY3DPEHPK3PXP',
        is_2fa_enabled: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'usr_auditor_04',
        email: 'auditor@aegisquant.finance',
        password_hash: auditorPasswordHash,
        role: 'AUDITOR',
        full_name: 'Elena Rostova (Lead Smart Contract & Compliance Auditor)',
        totp_secret: 'JBSWY3DPEHPK3PXP',
        is_2fa_enabled: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'usr_viewer_05',
        email: 'viewer@aegisquant.finance',
        password_hash: viewerPasswordHash,
        role: 'VIEWER',
        full_name: 'Institutional LP Viewer',
        is_2fa_enabled: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    defaultUsers.forEach(u => this.users.set(u.id, u));

    // 2. Treasury Reserve Buckets (Configured with exact Decimal balances)
    const initialReserves: TreasuryReserveRow[] = [
      {
        id: 'RES_OPERATING',
        bucket_type: 'OPERATING',
        token_symbol: 'USDC',
        balance: '102454.800000000000000000',
        target_percentage: 40.0,
        contract_vault_address: '0x38b0A5f15dC728bFe6C5d892608493184Fe21990',
        blockchain: 'Arbitrum One',
        last_reconciled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'RES_INSURANCE_RISK',
        bucket_type: 'INSURANCE_RISK',
        token_symbol: 'USDC',
        balance: '76841.100000000000000000',
        target_percentage: 30.0,
        contract_vault_address: '0x71cA9B801De67280E8A57F0C85289948Fa3788aA',
        blockchain: 'Arbitrum One',
        last_reconciled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'RES_COLD_TREASURY',
        bucket_type: 'COLD_TREASURY',
        token_symbol: 'USDC',
        balance: '51227.400000000000000000',
        target_percentage: 20.0,
        contract_vault_address: '0x991823aA12Bc90F8e9389201Dcb7678129038234',
        blockchain: 'Arbitrum One',
        last_reconciled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'RES_REINVESTMENT',
        bucket_type: 'REINVESTMENT',
        token_symbol: 'USDC',
        balance: '25613.700000000000000000',
        target_percentage: 10.0,
        contract_vault_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        blockchain: 'Arbitrum One',
        last_reconciled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    initialReserves.forEach(r => this.reserves.set(r.id, r));

    // 3. Initial Double-Entry Ledger Transactions
    const initialLedger: TreasuryLedgerRow[] = [
      {
        id: 'leg_init_01',
        tx_hash: '0x7a82b91c0e3f5d1a892b0c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f',
        idempotency_key: 'IDEM_INIT_CAPITAL_01',
        bucket_from: 'EXTERNAL_DEPOSIT',
        bucket_to: 'OPERATING',
        token_symbol: 'USDC',
        token_amount: '102454.800000000000000000',
        usd_value: '102454.800000',
        balance_before_usd: '0.000000',
        balance_after_usd: '102454.800000',
        memo: 'Genesis Capital Provisioning - Operating Reserve Allocation',
        auth_policy: 'GovernanceProposal #001 (Multi-Sig 3/5 Approved)',
        performed_by_user_id: 'usr_admin_01',
        blockchain: 'Arbitrum One',
        block_number: 18400010,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'leg_init_02',
        tx_hash: '0x8b93c02d1f4a6e2b903c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
        idempotency_key: 'IDEM_INIT_CAPITAL_02',
        bucket_from: 'EXTERNAL_DEPOSIT',
        bucket_to: 'INSURANCE_RISK',
        token_symbol: 'USDC',
        token_amount: '76841.100000000000000000',
        usd_value: '76841.100000',
        balance_before_usd: '0.000000',
        balance_after_usd: '76841.100000',
        memo: 'Genesis Risk Buffer Capitalization for Adverse Liquidation Cushion',
        auth_policy: 'GovernanceProposal #001 (Multi-Sig 3/5 Approved)',
        performed_by_user_id: 'usr_admin_01',
        blockchain: 'Arbitrum One',
        block_number: 18400012,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'leg_init_03',
        tx_hash: '0x9c04d13e2a5b7f3c014d2e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b',
        idempotency_key: 'IDEM_INIT_CAPITAL_03',
        bucket_from: 'EXTERNAL_DEPOSIT',
        bucket_to: 'COLD_TREASURY',
        token_symbol: 'USDC',
        token_amount: '51227.400000000000000000',
        usd_value: '51227.400000',
        balance_before_usd: '0.000000',
        balance_after_usd: '51227.400000',
        memo: 'Retained Institutional Surplus transferred to Gnosis Safe Cold Storage',
        auth_policy: 'GovernanceProposal #001 (Multi-Sig 3/5 Approved)',
        performed_by_user_id: 'usr_admin_01',
        blockchain: 'Arbitrum One',
        block_number: 18400015,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'leg_init_04',
        tx_hash: '0x0d15e24f3b6c8a4d125e3f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c',
        idempotency_key: 'IDEM_INIT_CAPITAL_04',
        bucket_from: 'EXTERNAL_DEPOSIT',
        bucket_to: 'REINVESTMENT',
        token_symbol: 'USDC',
        token_amount: '25613.700000000000000000',
        usd_value: '25613.700000',
        balance_before_usd: '0.000000',
        balance_after_usd: '25613.700000',
        memo: 'Auto-Compounding Seed Shares allocated to StrategyRegistry.sol',
        auth_policy: 'GovernanceProposal #001 (Multi-Sig 3/5 Approved)',
        performed_by_user_id: 'usr_admin_01',
        blockchain: 'Arbitrum One',
        block_number: 18400018,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ];

    this.ledger = initialLedger;

    // 4. Live Collateralized Loan Positions
    const initialPositions: CollateralPositionRow[] = [
      {
        id: 'POS_AAVE_WETH_01',
        protocol: 'Aave V3 Core',
        blockchain: 'Arbitrum One',
        collateral_asset: 'WETH',
        collateral_amount: '85.000000000000000000',
        collateral_price_usd: '3482.500000',
        borrowed_asset: 'USDC',
        borrowed_amount: '165000.000000000000000000',
        borrowed_price_usd: '1.000000',
        liquidation_threshold: 0.8500,
        borrow_apr_pct: 4.1200,
        supply_apy_pct: 1.8500,
        status: 'HEALTHY',
        updated_at: new Date().toISOString()
      },
      {
        id: 'POS_COMPOUND_WSTETH_02',
        protocol: 'Compound V3 (Comet)',
        blockchain: 'Arbitrum One',
        collateral_asset: 'wstETH',
        collateral_amount: '42.500000000000000000',
        collateral_price_usd: '4057.058823',
        borrowed_asset: 'WETH',
        borrowed_amount: '28.000000000000000000',
        borrowed_price_usd: '3482.500000',
        liquidation_threshold: 0.8800,
        borrow_apr_pct: 2.8500,
        supply_apy_pct: 3.4200,
        status: 'HEALTHY',
        updated_at: new Date().toISOString()
      },
      {
        id: 'POS_AAVE_WBTC_03',
        protocol: 'Aave V3 Core',
        blockchain: 'Ethereum Sepolia',
        collateral_asset: 'WBTC',
        collateral_amount: '2.500000000000000000',
        collateral_price_usd: '64280.000000',
        borrowed_asset: 'USDC',
        borrowed_amount: '78000.000000000000000000',
        borrowed_price_usd: '1.000000',
        liquidation_threshold: 0.8000,
        borrow_apr_pct: 4.3000,
        supply_apy_pct: 0.9500,
        status: 'HEALTHY',
        updated_at: new Date().toISOString()
      }
    ];

    initialPositions.forEach(p => this.positions.set(p.id, p));

    // 5. Quantitative Strategies
    const initialStrategies: QuantStrategyRow[] = [
      {
        id: 'STRAT_ETH_DELTA_NEUTRAL',
        name: 'ETH/stETH Basis & Staking Yield',
        category: 'DELTA_NEUTRAL_ARBITRAGE',
        target_protocol: 'Aave V3 + Curve + Lido',
        status: 'ACTIVE',
        allocated_capital_usd: '150000.00',
        max_leverage: 2.2,
        max_ltv: 0.7000,
        min_health_factor: 1.3500,
        current_sharpe: 2.450,
        current_sortino: 3.620,
        max_drawdown_pct: 3.400,
        win_rate_pct: 94.20,
        total_pnl_usd: '14820.50',
        last_simulated_return_pct: 9.850,
        updated_at: new Date().toISOString()
      },
      {
        id: 'STRAT_CROSS_DEX_ARB',
        name: 'Cross-DEX Atomic Liquidity Disparity',
        category: 'CROSS_DEX_LIQUIDITY_REBALANCE',
        target_protocol: 'Uniswap V3 + Camelot DEX',
        status: 'ACTIVE',
        allocated_capital_usd: '65000.00',
        max_leverage: 1.0,
        max_ltv: 0.5000,
        min_health_factor: 1.5000,
        current_sharpe: 3.120,
        current_sortino: 4.890,
        max_drawdown_pct: 1.200,
        win_rate_pct: 98.40,
        total_pnl_usd: '8940.20',
        last_simulated_return_pct: 14.200,
        updated_at: new Date().toISOString()
      },
      {
        id: 'STRAT_VOLATILITY_HARVEST',
        name: 'Automated Concentrated Liquidity Harvesting',
        category: 'VOLATILITY_HARVEST',
        target_protocol: 'Uniswap V3 Concentrated Ranges',
        status: 'ACTIVE',
        allocated_capital_usd: '41137.00',
        max_leverage: 1.5,
        max_ltv: 0.6000,
        min_health_factor: 1.4000,
        current_sharpe: 1.950,
        current_sortino: 2.740,
        max_drawdown_pct: 4.800,
        win_rate_pct: 88.60,
        total_pnl_usd: '5120.40',
        last_simulated_return_pct: 11.500,
        updated_at: new Date().toISOString()
      }
    ];

    initialStrategies.forEach(s => this.strategies.set(s.id, s));

    // 6. Security Circuit Breakers
    const initialBreakers: CircuitBreakerRow[] = [
      {
        id: 'CB_ORACLE_DIVERGENCE',
        name: 'Dual-Oracle Divergence Guard',
        trigger_condition: 'Δ > 1.50% between Chainlink and Uniswap TWAP',
        current_metric: '0.04% Divergence',
        is_tripped: false,
        severity: 'HIGH',
        last_tripped_at: null,
        last_checked_at: new Date().toISOString()
      },
      {
        id: 'CB_FLASH_CRASH',
        name: 'Rapid Volatility Circuit Breaker',
        trigger_condition: 'Collateral price drop > 15.0% within 1 hour',
        current_metric: '-0.32% / 1h',
        is_tripped: false,
        severity: 'CRITICAL',
        last_tripped_at: null,
        last_checked_at: new Date().toISOString()
      },
      {
        id: 'CB_HEALTH_FACTOR_FLOOR',
        name: 'Emergency Health Factor Floor',
        trigger_condition: 'Any active loan Health Factor < 1.150',
        current_metric: 'Min Active HF: 1.5249',
        is_tripped: false,
        severity: 'CRITICAL',
        last_tripped_at: null,
        last_checked_at: new Date().toISOString()
      },
      {
        id: 'CB_MAX_DAILY_DRAWDOWN',
        name: 'Maximum 24h Portfolio Drawdown',
        trigger_condition: 'Net daily loss > $10,000 USD or > 5.0% equity',
        current_metric: '+$203.80 (Profitable)',
        is_tripped: false,
        severity: 'HIGH',
        last_tripped_at: null,
        last_checked_at: new Date().toISOString()
      },
      {
        id: 'CB_GAS_SURGE',
        name: 'Network Gas Price Surge Guard',
        trigger_condition: 'Base fee > 65 Gwei',
        current_metric: '18.4 Gwei',
        is_tripped: false,
        severity: 'MEDIUM',
        last_tripped_at: null,
        last_checked_at: new Date().toISOString()
      }
    ];

    initialBreakers.forEach(b => this.circuitBreakers.set(b.id, b));

    // 7. Seed Initial Cryptographically Chained Audit Log
    this.recordAuditLogInternal({
      event_type: 'SYSTEM_BOOTSTRAP',
      user_id: 'usr_admin_01',
      user_email: 'admin@aegisquant.finance',
      user_role: 'ADMIN',
      ip_address: '127.0.0.1',
      user_agent: 'AegisCore/1.0.0 (Node.js)',
      action: 'SYSTEM_GENESIS_INITIALIZATION',
      details_json: {
        total_reserves_usd: '256137.00',
        active_positions_count: 3,
        circuit_breakers_armed: 5,
        compliance_standard: 'SOC2_TYPE2_FINTECH_HIGH_ASSURANCE'
      }
    });

    this.initialized = true;
  }

  // ----------------------------------------------------
  // AUDIT LOGGING ENGINE (IMMUTABLE HASH CHAINING)
  // ----------------------------------------------------
  public recordAuditLogInternal(params: {
    event_type: string;
    user_id?: string | null;
    user_email?: string | null;
    user_role: string;
    ip_address: string;
    user_agent?: string | null;
    action: string;
    details_json: Record<string, any>;
  }): AuditLogRow {
    const prevHash = this.lastAuditHash;
    const eventUuid = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    // Compute SHA-256 HMAC of (prevHash + payload)
    const payloadToHash = JSON.stringify({
      prevHash,
      eventUuid,
      eventType: params.event_type,
      userId: params.user_id,
      userRole: params.user_role,
      action: params.action,
      ipAddress: params.ip_address,
      details: params.details_json,
      createdAt
    });

    const currentHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');
    this.lastAuditHash = currentHash;

    const logEntry: AuditLogRow = {
      id: this.auditLogs.length + 1,
      event_uuid: eventUuid,
      event_type: params.event_type,
      user_id: params.user_id || null,
      user_email: params.user_email || null,
      user_role: params.user_role,
      ip_address: params.ip_address,
      user_agent: params.user_agent || null,
      action: params.action,
      details_json: params.details_json,
      prev_hash: prevHash,
      current_hash: currentHash,
      created_at: createdAt
    };

    this.auditLogs.unshift(logEntry); // Newest first
    return logEntry;
  }

  public getAuditLogs(limit: number = 50, eventType?: string): AuditLogRow[] {
    let list = this.auditLogs;
    if (eventType) {
      list = list.filter(l => l.event_type === eventType);
    }
    return list.slice(0, limit);
  }

  public verifyAuditChainIntegrity(): { isValid: boolean; verifiedCount: number; brokenAtId: number | null } {
    const reversed = [...this.auditLogs].reverse(); // Oldest to newest
    let prev = '0000000000000000000000000000000000000000000000000000000000000000';
    
    for (let i = 0; i < reversed.length; i++) {
      const entry = reversed[i];
      if (entry.prev_hash !== prev) {
        return { isValid: false, verifiedCount: i, brokenAtId: entry.id };
      }

      const payloadToHash = JSON.stringify({
        prevHash: entry.prev_hash,
        eventUuid: entry.event_uuid,
        eventType: entry.event_type,
        userId: entry.user_id,
        userRole: entry.user_role,
        action: entry.action,
        ipAddress: entry.ip_address,
        details: entry.details_json,
        createdAt: entry.created_at
      });

      const computed = crypto.createHash('sha256').update(payloadToHash).digest('hex');
      if (computed !== entry.current_hash) {
        return { isValid: false, verifiedCount: i, brokenAtId: entry.id };
      }

      prev = entry.current_hash;
    }

    return { isValid: true, verifiedCount: reversed.length, brokenAtId: null };
  }

  // ----------------------------------------------------
  // IAM & AUTH METHODS
  // ----------------------------------------------------
  public getUserByEmail(email: string): UserRow | undefined {
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserById(id: string): UserRow | undefined {
    return this.users.get(id);
  }

  public updateUserLoginSuccess(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      user.failed_login_attempts = 0;
      user.locked_until = null;
      user.last_login_at = new Date().toISOString();
      user.updated_at = new Date().toISOString();
    }
  }

  public registerFailedLogin(email: string, maxAttempts: number = 5, lockoutMinutes: number = 15): { isLocked: boolean; remainingAttempts: number } {
    const user = this.getUserByEmail(email);
    if (!user) return { isLocked: false, remainingAttempts: maxAttempts };

    user.failed_login_attempts += 1;
    if (user.failed_login_attempts >= maxAttempts) {
      const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
      user.locked_until = lockUntil;
      user.updated_at = new Date().toISOString();
      return { isLocked: true, remainingAttempts: 0 };
    }

    return { isLocked: false, remainingAttempts: maxAttempts - user.failed_login_attempts };
  }

  public getAllUsers(): Omit<UserRow, 'password_hash' | 'totp_secret'>[] {
    return Array.from(this.users.values()).map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      full_name: u.full_name,
      is_2fa_enabled: u.is_2fa_enabled,
      failed_login_attempts: u.failed_login_attempts,
      locked_until: u.locked_until,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      updated_at: u.updated_at
    }));
  }

  // ----------------------------------------------------
  // TREASURY & LEDGER EXACT ARITHMETIC
  // ----------------------------------------------------
  public getTreasurySummary() {
    let totalOperating = new Decimal(0);
    let totalRisk = new Decimal(0);
    let totalCold = new Decimal(0);
    let totalReinvest = new Decimal(0);

    for (const res of this.reserves.values()) {
      const bal = new Decimal(res.balance);
      if (res.bucket_type === 'OPERATING') totalOperating = totalOperating.plus(bal);
      else if (res.bucket_type === 'INSURANCE_RISK') totalRisk = totalRisk.plus(bal);
      else if (res.bucket_type === 'COLD_TREASURY') totalCold = totalCold.plus(bal);
      else if (res.bucket_type === 'REINVESTMENT') totalReinvest = totalReinvest.plus(bal);
    }

    const totalReserve = totalOperating.plus(totalRisk).plus(totalCold).plus(totalReinvest);

    // Calculate actual live percentages
    const operatingPct = totalReserve.isZero() ? 0 : totalOperating.dividedBy(totalReserve).times(100).toNumber();
    const riskPct = totalReserve.isZero() ? 0 : totalRisk.dividedBy(totalReserve).times(100).toNumber();
    const coldPct = totalReserve.isZero() ? 0 : totalCold.dividedBy(totalReserve).times(100).toNumber();
    const reinvestPct = totalReserve.isZero() ? 0 : totalReinvest.dividedBy(totalReserve).times(100).toNumber();

    return {
      operatingReserveUsd: totalOperating.toNumber(),
      riskReserveUsd: totalRisk.toNumber(),
      coreTreasuryUsd: totalCold.toNumber(),
      strategyReinvestmentUsd: totalReinvest.toNumber(),
      totalReserveUsd: totalReserve.toNumber(),
      operatingReservePct: Math.round(operatingPct * 100) / 100,
      riskReservePct: Math.round(riskPct * 100) / 100,
      treasuryPct: Math.round(coldPct * 100) / 100,
      reinvestmentPct: Math.round(reinvestPct * 100) / 100,
      reservesList: Array.from(this.reserves.values())
    };
  }

  public getLedgerEntries(limit: number = 50): TreasuryLedgerRow[] {
    return this.ledger.slice(0, limit);
  }

  public executeLedgerTransaction(params: {
    bucket_from: 'OPERATING' | 'INSURANCE_RISK' | 'COLD_TREASURY' | 'REINVESTMENT' | 'EXTERNAL_DEPOSIT' | 'STRATEGY_PROFIT';
    bucket_to: 'OPERATING' | 'INSURANCE_RISK' | 'COLD_TREASURY' | 'REINVESTMENT' | 'EXTERNAL_WITHDRAWAL';
    token_symbol: string;
    token_amount: string | number;
    usd_value: string | number;
    memo: string;
    auth_policy: string;
    performed_by_user_id: string;
    idempotency_key?: string;
  }): TreasuryLedgerRow {
    const amountDec = new Decimal(params.token_amount);
    const usdDec = new Decimal(params.usd_value);

    if (amountDec.lessThanOrEqualTo(0) || usdDec.lessThanOrEqualTo(0)) {
      throw new Error('Transaction amount and USD value must be strictly positive');
    }

    // Check source bucket balance if not external deposit
    let sourceReserve: TreasuryReserveRow | undefined;
    if (params.bucket_from !== 'EXTERNAL_DEPOSIT' && params.bucket_from !== 'STRATEGY_PROFIT') {
      sourceReserve = Array.from(this.reserves.values()).find(r => r.bucket_type === params.bucket_from);
      if (!sourceReserve) throw new Error(`Source reserve bucket ${params.bucket_from} not found`);
      
      const currentSourceBal = new Decimal(sourceReserve.balance);
      if (currentSourceBal.lessThan(amountDec)) {
        throw new Error(`Insufficient funds in ${params.bucket_from}: available ${currentSourceBal.toString()}, requested ${amountDec.toString()}`);
      }
    }

    let targetReserve: TreasuryReserveRow | undefined;
    if (params.bucket_to !== 'EXTERNAL_WITHDRAWAL') {
      targetReserve = Array.from(this.reserves.values()).find(r => r.bucket_type === params.bucket_to);
      if (!targetReserve) throw new Error(`Target reserve bucket ${params.bucket_to} not found`);
    }

    const beforeSummary = this.getTreasurySummary();

    // Deduct from source
    if (sourceReserve) {
      sourceReserve.balance = new Decimal(sourceReserve.balance).minus(amountDec).toString();
      sourceReserve.updated_at = new Date().toISOString();
    }

    // Add to target
    if (targetReserve) {
      targetReserve.balance = new Decimal(targetReserve.balance).plus(amountDec).toString();
      targetReserve.updated_at = new Date().toISOString();
    }

    const afterSummary = this.getTreasurySummary();

    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const ledgerEntry: TreasuryLedgerRow = {
      id: `leg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      tx_hash: txHash,
      idempotency_key: params.idempotency_key || null,
      bucket_from: params.bucket_from,
      bucket_to: params.bucket_to,
      token_symbol: params.token_symbol,
      token_amount: amountDec.toString(),
      usd_value: usdDec.toFixed(6),
      balance_before_usd: new Decimal(beforeSummary.totalReserveUsd).toFixed(6),
      balance_after_usd: new Decimal(afterSummary.totalReserveUsd).toFixed(6),
      memo: params.memo,
      auth_policy: params.auth_policy,
      performed_by_user_id: params.performed_by_user_id,
      blockchain: 'Arbitrum One',
      block_number: 18492000 + Math.floor(Math.random() * 1000),
      created_at: new Date().toISOString()
    };

    this.ledger.unshift(ledgerEntry);
    return ledgerEntry;
  }

  // ----------------------------------------------------
  // ZERO-FRICTION NET PROFIT WITHDRAWAL PROTOCOL
  // ----------------------------------------------------
  public withdrawNetProfit(params: {
    amountUsd: number;
    destinationAddress: string;
    userId: string;
    userEmail: string;
    userRole: string;
    memo?: string;
  }) {
    const amountDec = new Decimal(params.amountUsd);
    if (amountDec.lessThanOrEqualTo(0)) {
      throw new Error('Withdrawal amount must be strictly positive');
    }

    const coldReserve = this.reserves.get('RES_COLD_TREASURY');
    if (!coldReserve) {
      throw new Error('Cold Treasury reserve bucket not found');
    }

    const currentBal = new Decimal(coldReserve.balance);
    if (currentBal.lessThan(amountDec)) {
      throw new Error(`Insufficient liquid Cold Treasury funds: requested $${amountDec.toFixed(2)}, available $${currentBal.toFixed(2)}`);
    }

    // Deduct from Cold Treasury
    coldReserve.balance = currentBal.minus(amountDec).toString();
    coldReserve.updated_at = new Date().toISOString();

    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const ledgerEntry: TreasuryLedgerRow = {
      id: `leg_wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      tx_hash: txHash,
      idempotency_key: `IDEM_WD_${Date.now()}`,
      bucket_from: 'COLD_TREASURY',
      bucket_to: 'EXTERNAL_WITHDRAWAL',
      token_symbol: 'USDC',
      token_amount: amountDec.toString(),
      usd_value: amountDec.toFixed(6),
      balance_before_usd: currentBal.toFixed(6),
      balance_after_usd: new Decimal(coldReserve.balance).toFixed(6),
      memo: params.memo || `Zero-Friction Net Profit Sweep Withdrawal to Owner Primary Account (${params.destinationAddress})`,
      auth_policy: `Direct Owner Liquidity Protocol (Zero-Friction Extraction)`,
      performed_by_user_id: params.userId,
      blockchain: 'Arbitrum One',
      block_number: 18492000 + Math.floor(Math.random() * 1000),
      created_at: new Date().toISOString()
    };

    this.ledger.unshift(ledgerEntry);

    this.recordAuditLogInternal({
      event_type: 'NET_PROFIT_WITHDRAWAL',
      user_id: params.userId,
      user_email: params.userEmail,
      user_role: params.userRole,
      ip_address: '127.0.0.1',
      action: 'ZERO_FRICTION_NET_PROFIT_WITHDRAWAL',
      details_json: {
        amount_usd: amountDec.toNumber(),
        destination: params.destinationAddress,
        tx_hash: txHash,
        remaining_cold_balance: coldReserve.balance
      }
    });

    return {
      success: true,
      ledgerEntry,
      amountWithdrawnUsd: amountDec.toNumber(),
      destinationAddress: params.destinationAddress,
      remainingColdTreasuryUsd: new Decimal(coldReserve.balance).toNumber(),
      txHash
    };
  }

  // ----------------------------------------------------
  // COLLATERAL & RISK
  // ----------------------------------------------------
  public getCollateralPositions() {
    return Array.from(this.positions.values()).map(p => {
      const colAmt = new Decimal(p.collateral_amount);
      const colPrice = new Decimal(p.collateral_price_usd);
      const colVal = colAmt.times(colPrice);

      const borAmt = new Decimal(p.borrowed_amount);
      const borPrice = new Decimal(p.borrowed_price_usd);
      const debtVal = borAmt.times(borPrice);

      const ltv = colVal.isZero() ? new Decimal(0) : debtVal.dividedBy(colVal);
      const liqThresh = new Decimal(p.liquidation_threshold);
      const healthFactor = debtVal.isZero() ? new Decimal(999) : colVal.times(liqThresh).dividedBy(debtVal);

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL_DEFENSE' | 'LIQUIDATION_RISK' = 'HEALTHY';
      if (healthFactor.lessThan(1.15)) status = 'LIQUIDATION_RISK';
      else if (healthFactor.lessThan(1.35)) status = 'CRITICAL_DEFENSE';
      else if (healthFactor.lessThan(1.50)) status = 'WARNING';

      return {
        id: p.id,
        protocol: p.protocol,
        blockchain: p.blockchain,
        collateralAsset: p.collateral_asset,
        collateralAmount: colAmt.toNumber(),
        collateralValueUsd: colVal.toNumber(),
        borrowedAsset: p.borrowed_asset,
        borrowedAmount: borAmt.toNumber(),
        borrowedDebtUsd: debtVal.toNumber(),
        ltv: Math.round(ltv.toNumber() * 10000) / 10000,
        liquidationThreshold: p.liquidation_threshold,
        healthFactor: Math.round(healthFactor.toNumber() * 10000) / 10000,
        borrowAprPct: p.borrow_apr_pct,
        supplyApyPct: p.supply_apy_pct,
        status,
        updated_at: p.updated_at
      };
    });
  }

  public getStrategies(): QuantStrategyRow[] {
    return Array.from(this.strategies.values());
  }

  public getCircuitBreakers(): CircuitBreakerRow[] {
    return Array.from(this.circuitBreakers.values());
  }

  public toggleCircuitBreaker(id: string, user: { id: string; email: string; role: string; ip: string }): CircuitBreakerRow {
    const breaker = this.circuitBreakers.get(id);
    if (!breaker) throw new Error(`Circuit breaker ${id} not found`);

    breaker.is_tripped = !breaker.is_tripped;
    breaker.last_tripped_at = breaker.is_tripped ? new Date().toISOString() : breaker.last_tripped_at;
    breaker.last_checked_at = new Date().toISOString();

    this.recordAuditLogInternal({
      event_type: 'CIRCUIT_BREAKER_TOGGLE',
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      ip_address: user.ip,
      action: breaker.is_tripped ? `TRIPPED_CIRCUIT_BREAKER_${id}` : `DISARMED_CIRCUIT_BREAKER_${id}`,
      details_json: {
        breaker_id: id,
        breaker_name: breaker.name,
        is_tripped: breaker.is_tripped,
        severity: breaker.severity
      }
    });

    return breaker;
  }

  // ----------------------------------------------------
  // IDEMPOTENCY ENGINE
  // ----------------------------------------------------
  public getIdempotencyRecord(key: string): IdempotencyRow | undefined {
    const rec = this.idempotencyStore.get(key);
    if (!rec) return undefined;
    if (new Date(rec.expires_at).getTime() < Date.now()) {
      this.idempotencyStore.delete(key);
      return undefined;
    }
    return rec;
  }

  public saveIdempotencyRecord(rec: IdempotencyRow) {
    this.idempotencyStore.set(rec.idempotency_key, rec);
  }

  // ----------------------------------------------------
  // HOURLY RECONCILIATION AUDITOR
  // ----------------------------------------------------
  public runReconciliationAudit(auditorName: string = 'AUTOMATED_HOURLY_CRON'): ReconciliationReportRow {
    let totalInflows = new Decimal(0);
    let totalOutflows = new Decimal(0);

    for (const tx of this.ledger) {
      const val = new Decimal(tx.usd_value);
      if (tx.bucket_from === 'EXTERNAL_DEPOSIT' || tx.bucket_from === 'STRATEGY_PROFIT') {
        totalInflows = totalInflows.plus(val);
      }
      if (tx.bucket_to === 'EXTERNAL_WITHDRAWAL') {
        totalOutflows = totalOutflows.plus(val);
      }
    }

    let actualReserves = new Decimal(0);
    for (const r of this.reserves.values()) {
      actualReserves = actualReserves.plus(new Decimal(r.balance));
    }

    const expectedNet = totalInflows.minus(totalOutflows);
    const discrepancy = actualReserves.minus(expectedNet).abs();
    const isBalanced = discrepancy.lessThan(0.01); // Within 1 cent tolerance for rounding

    const report: ReconciliationReportRow = {
      id: `REC_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      total_ledger_inflows_usd: totalInflows.toFixed(2),
      total_ledger_outflows_usd: totalOutflows.toFixed(2),
      expected_net_balance_usd: expectedNet.toFixed(2),
      actual_reserves_balance_usd: actualReserves.toFixed(2),
      discrepancy_usd: discrepancy.toFixed(4),
      is_balanced: isBalanced,
      audited_by: auditorName,
      created_at: new Date().toISOString()
    };

    this.reconciliationReports.unshift(report);
    return report;
  }

  public getReconciliationReports(limit: number = 10): ReconciliationReportRow[] {
    if (this.reconciliationReports.length === 0) {
      this.runReconciliationAudit('GENESIS_INITIALIZER');
    }
    return this.reconciliationReports.slice(0, limit);
  }
}

export const db = new AegisProductionDatabase();
