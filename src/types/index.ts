export type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'CIRCUIT_BREAKER_ACTIVE' | 'EMERGENCY_PAUSED';

export type GateLevel = 
  | 'GATE_1_UNIT_TESTS'
  | 'GATE_2_BACKTEST_RISK'
  | 'GATE_3_SMART_CONTRACT_FUZZ'
  | 'GATE_4_TESTNET_VALIDATION'
  | 'GATE_5_SECURITY_AUDIT'
  | 'GATE_6_STAGING_DEPLOY'
  | 'GATE_7_GOVERNANCE_CAPITAL';

export type RiskDecision = 
  | 'APPROVED'
  | 'REJECTED'
  | 'REDUCE_POSITION'
  | 'CLOSE_POSITION'
  | 'EMERGENCY_STOP';

export type ExecutionState =
  | 'CREATED'
  | 'SIMULATING'
  | 'SIMULATION_FAILED'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REVERTED'
  | 'CANCELLED';

export interface TreasuryReserve {
  operatingReserveUsd: number;
  riskReserveUsd: number;
  coreTreasuryUsd: number;
  strategyReinvestmentUsd: number;
  totalReserveUsd: number;
  operatingReservePct: number;
  riskReservePct: number;
  treasuryPct: number;
  reinvestmentPct: number;
}

export interface AutonomousEngineStatus {
  is_daemon_active: boolean;
  execution_mode: string;
  operational_authority: string;
  total_autonomous_cycles: number;
  total_yield_processed_usd: number;
  total_net_profit_swept_usd: number;
  partitioning_protocol: {
    net_profit_sweep_rate: string;
    net_profit_liquidity: string;
    legacy_matrix_rate: string;
  };
  last_heartbeat: string;
  auto_healing_events: Array<{
    id: string;
    timestamp: string;
    trigger: string;
    issue_detected: string;
    autonomous_action_taken: string;
    recovery_time_ms: number;
    status: string;
  }>;
}

export interface AutonomousSettlementResult {
  settlement_id: string;
  execution_mode: string;
  timestamp: string;
  source_strategy: string;
  gross_yield_usd: number;
  deterministic_partitioning: {
    net_profit_sweep_usd: number;
    net_profit_pct: number;
    destination_tag: string;
    legacy_matrix_pool_usd: number;
    legacy_matrix_pool_pct: number;
    legacy_breakdown: {
      operating_reserve_usd: number;
      operating_reserve_pct: number;
      risk_reserve_usd: number;
      risk_reserve_pct: number;
      cold_treasury_buffer_usd: number;
      cold_treasury_buffer_pct: number;
      strategy_reinvestment_usd: number;
      strategy_reinvestment_pct: number;
    };
  };
  settled_transactions: Array<{
    bucket: string;
    amount_usd: number;
    tx_hash: string;
    memo: string;
  }>;
  audit_hash: string;
  auto_healing_applied: boolean;
  status: string;
}

export interface CollateralPosition {
  id: string;
  protocol: string;
  blockchain: string;
  collateralAsset: string;
  collateralAmount: number;
  collateralValueUsd: number;
  borrowedAsset: string;
  borrowedAmount: number;
  borrowedDebtUsd: number;
  ltv: number;
  liquidationThreshold: number;
  healthFactor: number;
  borrowAprPct: number;
  supplyApyPct: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL_DEFENSE' | 'LIQUIDATION_RISK';
}

export interface QuantitativeStrategy {
  id: string;
  name: string;
  category: 'DELTA_NEUTRAL_ARBITRAGE' | 'COLLATERALIZED_YIELD_FARM' | 'CROSS_DEX_LIQUIDITY_REBALANCE' | 'VOLATILITY_HARVEST';
  targetProtocol: string;
  status: 'ACTIVE' | 'PAUSED' | 'SIMULATING' | 'GOVERNANCE_REVIEW';
  allocatedCapitalUsd: number;
  maxLeverage: number;
  maxLtv: number;
  minHealthFactor: number;
  currentSharpe: number;
  currentSortino: number;
  maxDrawdownPct: number;
  winRatePct: number;
  totalPnlUsd: number;
  lastSimulatedReturnPct: number;
}

export interface PipelineExecutionStep {
  step: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  durationMs?: number;
  detail: string;
  timestamp?: string;
}

export interface DatabaseTableMeta {
  tableName: string;
  category: 'IAM' | 'MARKET_DATA' | 'PORTFOLIO' | 'TRADING' | 'TREASURY' | 'RISK_AUDIT';
  description: string;
  primaryKey: string;
  foreignKeys: string[];
  indexes: string[];
  uniqueConstraints: string[];
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    description: string;
  }[];
}

export interface SmartContractSpec {
  name: string;
  standard: string;
  description: string;
  securityGuards: string[];
  keyFunctions: {
    signature: string;
    role: string;
    description: string;
  }[];
  solidityCode: string;
}

export interface DeploymentGateSpec {
  gateId: GateLevel;
  number: number;
  name: string;
  description: string;
  capitalCapUsd: number;
  status: 'PASSED' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED';
  prerequisites: string[];
  securityChecks: string[];
  verificationCriteria: string[];
}
