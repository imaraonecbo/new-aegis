-- ==============================================================================
-- AegisQuant Institutional DeFi Platform: Core Database Schema (PostgreSQL 16+)
-- Version: V1.0.0
-- Security: High Assurance / Immutable Audit Log / Bank-Grade Financial Precision
-- ==============================================================================

-- Enable UUID and Cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enums
CREATE TYPE user_role_type AS ENUM ('ADMIN', 'RISK_MANAGER', 'OPERATOR', 'AUDITOR', 'VIEWER');
CREATE TYPE position_status_type AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL_DEFENSE', 'LIQUIDATION_RISK');
CREATE TYPE strategy_status_type AS ENUM ('ACTIVE', 'PAUSED', 'SIMULATING', 'GOVERNANCE_REVIEW');
CREATE TYPE circuit_severity_type AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE ledger_bucket_type AS ENUM ('OPERATING', 'INSURANCE_RISK', 'COLD_TREASURY', 'REINVESTMENT', 'EXTERNAL_DEPOSIT', 'EXTERNAL_WITHDRAWAL');

-- 1. IAM & ACCESS CONTROL
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_type NOT NULL DEFAULT 'VIEWER',
    full_name VARCHAR(128) NOT NULL,
    totp_secret VARCHAR(128),
    is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. TREASURY RESERVE BUCKETS
CREATE TABLE IF NOT EXISTS treasury_reserves (
    id VARCHAR(64) PRIMARY KEY,
    bucket_type ledger_bucket_type NOT NULL,
    token_symbol VARCHAR(16) NOT NULL,
    balance NUMERIC(36, 18) NOT NULL DEFAULT 0.000000000000000000,
    target_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    contract_vault_address VARCHAR(66),
    blockchain VARCHAR(32) NOT NULL DEFAULT 'Arbitrum One',
    last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DOUBLE-ENTRY TREASURY LEDGER (IMMUTABLE JOURNAL)
CREATE TABLE IF NOT EXISTS treasury_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(66) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE,
    bucket_from ledger_bucket_type NOT NULL,
    bucket_to ledger_bucket_type NOT NULL,
    token_symbol VARCHAR(16) NOT NULL,
    token_amount NUMERIC(36, 18) NOT NULL,
    usd_value NUMERIC(24, 6) NOT NULL,
    balance_before_usd NUMERIC(24, 6) NOT NULL,
    balance_after_usd NUMERIC(24, 6) NOT NULL,
    memo TEXT NOT NULL,
    auth_policy VARCHAR(128) NOT NULL,
    performed_by_user_id UUID REFERENCES users(id),
    blockchain VARCHAR(32) NOT NULL DEFAULT 'Arbitrum One',
    block_number BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_created ON treasury_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_token ON treasury_ledger(token_symbol);
CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON treasury_ledger(idempotency_key);

-- 4. COLLATERALIZED LOAN & BORROW POSITIONS
CREATE TABLE IF NOT EXISTS collateral_positions (
    id VARCHAR(64) PRIMARY KEY,
    protocol VARCHAR(64) NOT NULL,
    blockchain VARCHAR(32) NOT NULL,
    collateral_asset VARCHAR(16) NOT NULL,
    collateral_amount NUMERIC(36, 18) NOT NULL,
    collateral_price_usd NUMERIC(18, 6) NOT NULL,
    borrowed_asset VARCHAR(16) NOT NULL,
    borrowed_amount NUMERIC(36, 18) NOT NULL,
    borrowed_price_usd NUMERIC(18, 6) NOT NULL,
    liquidation_threshold NUMERIC(6, 4) NOT NULL, -- e.g. 0.8500
    borrow_apr_pct NUMERIC(6, 4) NOT NULL,        -- e.g. 4.1200
    supply_apy_pct NUMERIC(6, 4) NOT NULL,        -- e.g. 1.8500
    status position_status_type NOT NULL DEFAULT 'HEALTHY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. QUANTITATIVE TRADING STRATEGIES
CREATE TABLE IF NOT EXISTS quant_strategies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    target_protocol VARCHAR(128) NOT NULL,
    status strategy_status_type NOT NULL DEFAULT 'ACTIVE',
    allocated_capital_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    max_leverage NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    max_ltv NUMERIC(6, 4) NOT NULL DEFAULT 0.7000,
    min_health_factor NUMERIC(6, 4) NOT NULL DEFAULT 1.3500,
    current_sharpe NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
    current_sortino NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
    max_drawdown_pct NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
    win_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    total_pnl_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    last_simulated_return_pct NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SECURITY CIRCUIT BREAKERS
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    trigger_condition VARCHAR(255) NOT NULL,
    current_metric VARCHAR(128) NOT NULL,
    is_tripped BOOLEAN NOT NULL DEFAULT FALSE,
    severity circuit_severity_type NOT NULL DEFAULT 'HIGH',
    last_tripped_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. IDEMPOTENCY LOCKS & RESPONSES
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    user_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_records(expires_at);

-- 8. CRYPTOGRAPHICALLY CHAINED AUDIT LOGS (IMMUTABLE)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(32) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    action TEXT NOT NULL,
    details_json JSONB NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- 9. HOURLY RECONCILIATION REPORTS
CREATE TABLE IF NOT EXISTS reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_ledger_inflows_usd NUMERIC(24, 6) NOT NULL,
    total_ledger_outflows_usd NUMERIC(24, 6) NOT NULL,
    expected_net_balance_usd NUMERIC(24, 6) NOT NULL,
    actual_reserves_balance_usd NUMERIC(24, 6) NOT NULL,
    discrepancy_usd NUMERIC(24, 6) NOT NULL,
    is_balanced BOOLEAN NOT NULL DEFAULT TRUE,
    audited_by VARCHAR(64) NOT NULL DEFAULT 'CRON_RECONCILIATION_ENGINE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments on tables for institutional compliance documentation
COMMENT ON TABLE treasury_ledger IS 'Immutable double-entry journal for all asset movements across protocol reserve vaults';
COMMENT ON TABLE audit_logs IS 'Cryptographically hash-chained audit log guaranteeing non-repudiation of actions';
