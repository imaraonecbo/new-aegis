import { DatabaseTableMeta } from '../types';

export const DATABASE_TABLES: DatabaseTableMeta[] = [
  // 1. IAM & Security
  {
    tableName: 'organizations',
    category: 'IAM',
    description: 'Multi-tenant enterprise entity managing DeFi capital, treasury rules and risk parameters.',
    primaryKey: 'id (UUID)',
    foreignKeys: [],
    indexes: ['idx_organizations_slug (UNIQUE)', 'idx_organizations_created_at'],
    uniqueConstraints: ['UNIQUE(slug)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Unique organization identifier' },
      { name: 'name', type: 'VARCHAR(255)', nullable: false, description: 'Organization legal/operating name' },
      { name: 'slug', type: 'VARCHAR(100) UNIQUE', nullable: false, description: 'URL-friendly unique handle' },
      { name: 'governance_multisig_address', type: 'VARCHAR(42)', nullable: false, description: 'Gnosis Safe or institutional multisig address' },
      { name: 'is_active', type: 'BOOLEAN DEFAULT true', nullable: false, description: 'Operational status flag' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Last modification timestamp' }
    ]
  },
  {
    tableName: 'users',
    category: 'IAM',
    description: 'Authenticated operators, risk managers, quants, and treasury administrators.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id) ON DELETE RESTRICT'],
    indexes: ['idx_users_org_email (organization_id, email)', 'idx_users_status'],
    uniqueConstraints: ['UNIQUE(organization_id, email)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'User identifier' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'email', type: 'VARCHAR(255)', nullable: false, description: 'Operator email address' },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false, description: 'Argon2id cryptographic password hash' },
      { name: 'mfa_secret_encrypted', type: 'TEXT', nullable: true, description: 'AES-256-GCM encrypted TOTP secret' },
      { name: 'mfa_enabled', type: 'BOOLEAN DEFAULT true', nullable: false, description: 'Mandatory MFA flag' },
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'ACTIVE\'', nullable: false, description: 'ACTIVE, SUSPENDED, PENDING_MFA' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Creation timestamp' }
    ]
  },
  {
    tableName: 'roles',
    category: 'IAM',
    description: 'Hierarchical RBAC role definitions (Risk Officer, Quant Engineer, Treasury Admin, Auditor).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_roles_org_name (organization_id, name)'],
    uniqueConstraints: ['UNIQUE(organization_id, name)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Role identifier' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'name', type: 'VARCHAR(100)', nullable: false, description: 'Role title' },
      { name: 'description', type: 'TEXT', nullable: true, description: 'Role responsibilities' },
      { name: 'is_system_role', type: 'BOOLEAN DEFAULT false', nullable: false, description: 'Immutable system protection flag' }
    ]
  },
  {
    tableName: 'permissions',
    category: 'IAM',
    description: 'Atomic action permissions (e.g. EXECUTE_STRATEGY, EMERGENCY_PAUSE, REALLOCATE_TREASURY).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['role_id REFERENCES roles(id) ON DELETE CASCADE'],
    indexes: ['idx_permissions_role_action (role_id, action)'],
    uniqueConstraints: ['UNIQUE(role_id, action, resource)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Permission identifier' },
      { name: 'role_id', type: 'UUID', nullable: false, description: 'Role foreign key' },
      { name: 'action', type: 'VARCHAR(100)', nullable: false, description: 'Permission action code' },
      { name: 'resource', type: 'VARCHAR(100)', nullable: false, description: 'Resource scope identifier' }
    ]
  },
  {
    tableName: 'wallets',
    category: 'IAM',
    description: 'Non-custodial smart contract wallets, HSM signers, and Gnosis Safe multisig metadata.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_wallets_org_type (organization_id, wallet_type)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Wallet metadata identifier' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'wallet_type', type: 'VARCHAR(50)', nullable: false, description: 'SAFE_MULTISIG, FIREBLOCKS_HSM, SMART_CONTRACT_VAULT' },
      { name: 'label', type: 'VARCHAR(150)', nullable: false, description: 'Friendly administrative label' },
      { name: 'threshold', type: 'INTEGER DEFAULT 2', nullable: false, description: 'Required signers threshold' }
    ]
  },
  {
    tableName: 'wallet_addresses',
    category: 'IAM',
    description: 'Specific on-chain addresses across supported EVM blockchains (No private keys stored).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['wallet_id REFERENCES wallets(id) ON DELETE CASCADE', 'blockchain_id REFERENCES blockchains(id)'],
    indexes: ['idx_wallet_addresses_chain_addr (blockchain_id, address)'],
    uniqueConstraints: ['UNIQUE(blockchain_id, address)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Address identifier' },
      { name: 'wallet_id', type: 'UUID', nullable: false, description: 'Parent wallet ID' },
      { name: 'blockchain_id', type: 'UUID', nullable: false, description: 'Blockchain foreign key' },
      { name: 'address', type: 'VARCHAR(42)', nullable: false, description: 'EVM 0x checksummed public address' },
      { name: 'is_whitelisted', type: 'BOOLEAN DEFAULT true', nullable: false, description: 'Compliance allowlist flag' }
    ]
  },

  // 2. Blockchain & Market Data
  {
    tableName: 'blockchains',
    category: 'MARKET_DATA',
    description: 'Supported EVM blockchain networks with verified RPC endpoints and chain IDs.',
    primaryKey: 'id (UUID)',
    foreignKeys: [],
    indexes: ['idx_blockchains_chain_id (chain_id UNIQUE)'],
    uniqueConstraints: ['UNIQUE(chain_id)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Network identifier' },
      { name: 'name', type: 'VARCHAR(100)', nullable: false, description: 'Ethereum, Arbitrum One, Optimism, Base' },
      { name: 'chain_id', type: 'BIGINT UNIQUE', nullable: false, description: 'EIP-155 Chain ID' },
      { name: 'is_testnet', type: 'BOOLEAN DEFAULT false', nullable: false, description: 'Testnet vs Mainnet marker' },
      { name: 'primary_rpc_url', type: 'VARCHAR(500)', nullable: false, description: 'Failover RPC node endpoint' },
      { name: 'block_time_seconds', type: 'NUMERIC(6,2)', nullable: false, description: 'Average block finality duration' }
    ]
  },
  {
    tableName: 'tokens',
    category: 'MARKET_DATA',
    description: 'Verified ERC-20 asset master with decimals, risk tiers, and oracle contract addresses.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['blockchain_id REFERENCES blockchains(id)'],
    indexes: ['idx_tokens_chain_contract (blockchain_id, contract_address)'],
    uniqueConstraints: ['UNIQUE(blockchain_id, contract_address)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Token identifier' },
      { name: 'blockchain_id', type: 'UUID', nullable: false, description: 'Blockchain foreign key' },
      { name: 'symbol', type: 'VARCHAR(30)', nullable: false, description: 'WETH, USDC, wstETH, DAI, WBTC' },
      { name: 'contract_address', type: 'VARCHAR(42)', nullable: false, description: 'Token contract address' },
      { name: 'decimals', type: 'SMALLINT', nullable: false, description: 'Precision decimals (e.g. 18, 6)' },
      { name: 'oracle_feed_address', type: 'VARCHAR(42)', nullable: false, description: 'Chainlink AggregatorV3 address' },
      { name: 'risk_tier', type: 'VARCHAR(20)', nullable: false, description: 'TIER_1_BLUECHIP, TIER_2_CORRELATED, TIER_3_EXOTIC' }
    ]
  },
  {
    tableName: 'protocols',
    category: 'MARKET_DATA',
    description: 'Audited DeFi protocols (Aave V3, Uniswap V3, Compound V3, Curve, Balancer).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['blockchain_id REFERENCES blockchains(id)'],
    indexes: ['idx_protocols_chain_code (blockchain_id, protocol_code)'],
    uniqueConstraints: ['UNIQUE(blockchain_id, protocol_code)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Protocol identifier' },
      { name: 'blockchain_id', type: 'UUID', nullable: false, description: 'Blockchain foreign key' },
      { name: 'name', type: 'VARCHAR(100)', nullable: false, description: 'Aave V3 Core, Uniswap V3 Router' },
      { name: 'protocol_code', type: 'VARCHAR(50)', nullable: false, description: 'AAVE_V3, UNISWAP_V3, COMPOUND_V3' },
      { name: 'contract_address', type: 'VARCHAR(42)', nullable: false, description: 'Primary entrypoint contract' },
      { name: 'is_governance_approved', type: 'BOOLEAN DEFAULT false', nullable: false, description: 'Must be explicitly approved before execution' },
      { name: 'audit_report_hash', type: 'VARCHAR(66)', nullable: true, description: 'IPFS / SHA-256 of security audit' }
    ]
  },
  {
    tableName: 'markets',
    category: 'MARKET_DATA',
    description: 'Specific lending pools or DEX pairs with liquidity and volatility tracking.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['protocol_id REFERENCES protocols(id)', 'base_token_id REFERENCES tokens(id)', 'quote_token_id REFERENCES tokens(id)'],
    indexes: ['idx_markets_protocol_pair (protocol_id, base_token_id, quote_token_id)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Market pool identifier' },
      { name: 'protocol_id', type: 'UUID', nullable: false, description: 'Protocol foreign key' },
      { name: 'base_token_id', type: 'UUID', nullable: false, description: 'Base token' },
      { name: 'quote_token_id', type: 'UUID', nullable: false, description: 'Quote token' },
      { name: 'pool_fee_tier_bps', type: 'INTEGER', nullable: true, description: 'DEX fee tier in bps (e.g. 5, 30, 100)' },
      { name: 'pool_address', type: 'VARCHAR(42)', nullable: false, description: 'Liquidity pool contract address' }
    ]
  },
  {
    tableName: 'price_ticks',
    category: 'MARKET_DATA',
    description: 'High-frequency price ticks ingested from oracles and DEX TWAP feeds with deviation guards.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['token_id REFERENCES tokens(id)'],
    indexes: ['idx_price_ticks_token_time (token_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Tick sequence ID' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Token foreign key' },
      { name: 'price_usd', type: 'NUMERIC(24,8)', nullable: false, description: 'Price in USD' },
      { name: 'oracle_source', type: 'VARCHAR(50)', nullable: false, description: 'CHAINLINK, UNISWAP_TWAP, PYTH' },
      { name: 'confidence_interval', type: 'NUMERIC(12,6)', nullable: true, description: 'Oracle reported uncertainty interval' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Tick timestamp' }
    ]
  },
  {
    tableName: 'liquidity_snapshots',
    category: 'MARKET_DATA',
    description: 'DEX depth and lending pool available borrow capacity snapshots for slippage estimation.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['market_id REFERENCES markets(id)'],
    indexes: ['idx_liquidity_market_time (market_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Snapshot sequence ID' },
      { name: 'market_id', type: 'UUID', nullable: false, description: 'Market foreign key' },
      { name: 'total_liquidity_usd', type: 'NUMERIC(28,4)', nullable: false, description: 'Total pool depth in USD' },
      { name: 'available_borrow_capacity_usd', type: 'NUMERIC(28,4)', nullable: true, description: 'Unutilized pool borrowing liquidity' },
      { name: 'utilization_rate_pct', type: 'NUMERIC(6,3)', nullable: true, description: 'Lending pool utilization rate' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Snapshot timestamp' }
    ]
  },

  // 3. Strategy & Risk Parameters
  {
    tableName: 'strategies',
    category: 'PORTFOLIO',
    description: 'Quantitative strategy definitions registered in the on-chain StrategyRegistry.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_strategies_org_status (organization_id, status)'],
    uniqueConstraints: ['UNIQUE(organization_id, strategy_code)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Strategy identifier' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'strategy_code', type: 'VARCHAR(100)', nullable: false, description: 'STRAT_ETH_DELTA_NEUTRAL, STRAT_STETH_ARB' },
      { name: 'name', type: 'VARCHAR(200)', nullable: false, description: 'Human-readable strategy title' },
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'PAUSED\'', nullable: false, description: 'ACTIVE, PAUSED, BACKTESTING, GOVERNANCE_REVIEW' },
      { name: 'onchain_registry_address', type: 'VARCHAR(42)', nullable: true, description: 'StrategyRegistry.sol contract address' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Creation timestamp' }
    ]
  },
  {
    tableName: 'strategy_parameters',
    category: 'PORTFOLIO',
    description: 'Versioned algorithmic parameters for rebalancing, thresholds, and execution frequencies.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['strategy_id REFERENCES strategies(id) ON DELETE CASCADE'],
    indexes: ['idx_strat_params_strategy_version (strategy_id, version DESC)'],
    uniqueConstraints: ['UNIQUE(strategy_id, version)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Parameter version ID' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Strategy foreign key' },
      { name: 'version', type: 'INTEGER', nullable: false, description: 'Sequential parameter version' },
      { name: 'parameters_json', type: 'JSONB', nullable: false, description: 'JSON structure containing threshold, weights, trigger intervals' },
      { name: 'approved_by_user_id', type: 'UUID', nullable: false, description: 'Risk officer who signed approval' },
      { name: 'effective_from', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Activation timestamp' }
    ]
  },
  {
    tableName: 'risk_parameters',
    category: 'PORTFOLIO',
    description: 'Institutional risk invariants enforced by Python Risk Engine & RiskController.sol.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['strategy_id REFERENCES strategies(id)'],
    indexes: ['idx_risk_params_strategy (strategy_id)'],
    uniqueConstraints: ['UNIQUE(strategy_id)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Risk parameter ID' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Associated strategy' },
      { name: 'max_leverage', type: 'NUMERIC(4,2) DEFAULT 2.50', nullable: false, description: 'Hard leverage ceiling' },
      { name: 'max_ltv_pct', type: 'NUMERIC(5,2) DEFAULT 75.00', nullable: false, description: 'Maximum permitted Loan-To-Value ratio' },
      { name: 'min_health_factor', type: 'NUMERIC(6,3) DEFAULT 1.350', nullable: false, description: 'Minimum allowed liquidation health factor' },
      { name: 'liquidation_buffer_pct', type: 'NUMERIC(5,2) DEFAULT 20.00', nullable: false, description: 'Minimum price buffer before liquidation point' },
      { name: 'max_position_size_usd', type: 'NUMERIC(24,2) DEFAULT 250000.00', nullable: false, description: 'Maximum allowable capital allocation' },
      { name: 'max_daily_loss_usd', type: 'NUMERIC(24,2) DEFAULT 10000.00', nullable: false, description: 'Max daily loss before circuit breaker triggers' },
      { name: 'max_slippage_bps', type: 'INTEGER DEFAULT 30', nullable: false, description: 'Max allowable swap price impact (0.30%)' },
      { name: 'max_gas_price_gwei', type: 'INTEGER DEFAULT 65', nullable: false, description: 'Max gas threshold for execution' }
    ]
  },

  // 4. Portfolio, Collateral & Loans
  {
    tableName: 'portfolio_positions',
    category: 'PORTFOLIO',
    description: 'Current aggregate asset positions, inventory, and net exposure.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_portfolio_org_token (organization_id, token_id)'],
    uniqueConstraints: ['UNIQUE(organization_id, token_id)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Position identifier' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Token foreign key' },
      { name: 'total_amount', type: 'NUMERIC(36,18)', nullable: false, description: 'Total tokens held' },
      { name: 'cost_basis_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Weighted average purchase price' },
      { name: 'current_value_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Current mark-to-market value' },
      { name: 'unrealized_pnl_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Mark-to-market unrealized profit/loss' }
    ]
  },
  {
    tableName: 'collateral_positions',
    category: 'PORTFOLIO',
    description: 'Collateral pledged into lending protocols (e.g. Aave aTokens, Compound cTokens).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)', 'protocol_id REFERENCES protocols(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_collateral_org_protocol (organization_id, protocol_id)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Collateral record ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'protocol_id', type: 'UUID', nullable: false, description: 'Lending protocol foreign key' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Collateral token' },
      { name: 'deposited_amount', type: 'NUMERIC(36,18)', nullable: false, description: 'Nominal tokens deposited' },
      { name: 'market_value_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'USD value from verified oracle' },
      { name: 'liquidation_threshold_pct', type: 'NUMERIC(5,2)', nullable: false, description: 'Protocol liquidation threshold (e.g. 85%)' }
    ]
  },
  {
    tableName: 'loans',
    category: 'PORTFOLIO',
    description: 'Active borrowed liabilities, interest rates, debt growth, and real-time Health Factors.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['collateral_position_id REFERENCES collateral_positions(id)', 'debt_token_id REFERENCES tokens(id)'],
    indexes: ['idx_loans_health_factor (health_factor)', 'idx_loans_status'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Loan record ID' },
      { name: 'collateral_position_id', type: 'UUID', nullable: false, description: 'Associated collateral position' },
      { name: 'debt_token_id', type: 'UUID', nullable: false, description: 'Borrowed debt token (e.g. USDC, DAI)' },
      { name: 'principal_debt', type: 'NUMERIC(36,18)', nullable: false, description: 'Original borrowed amount' },
      { name: 'accrued_interest', type: 'NUMERIC(36,18) DEFAULT 0', nullable: false, description: 'Accrued interest liability' },
      { name: 'total_debt_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Current total debt in USD' },
      { name: 'current_ltv_pct', type: 'NUMERIC(5,2)', nullable: false, description: 'Real-time Loan-To-Value percentage' },
      { name: 'health_factor', type: 'NUMERIC(8,4)', nullable: false, description: 'Real-time Health Factor: (CollateralValue * Threshold) / Debt' },
      { name: 'borrow_apr_pct', type: 'NUMERIC(6,3)', nullable: false, description: 'Current variable borrow APR' },
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'ACTIVE\'', nullable: false, description: 'ACTIVE, REPAID, LIQUIDATING, DEFENSIVE_REDUCED' }
    ]
  },
  {
    tableName: 'loan_events',
    category: 'PORTFOLIO',
    description: 'Lifecycle events for loans (BORROW, REPAY, COLLATERAL_TOPUP, INTEREST_ACCRUAL, LIQUIDATION_WARNING).',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['loan_id REFERENCES loans(id) ON DELETE CASCADE'],
    indexes: ['idx_loan_events_loan_time (loan_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Event sequence ID' },
      { name: 'loan_id', type: 'UUID', nullable: false, description: 'Loan foreign key' },
      { name: 'event_type', type: 'VARCHAR(50)', nullable: false, description: 'BORROW, REPAY_PARTIAL, REPAY_FULL, LIQUIDATION_ALERT' },
      { name: 'amount', type: 'NUMERIC(36,18)', nullable: false, description: 'Event amount' },
      { name: 'health_factor_before', type: 'NUMERIC(8,4)', nullable: false, description: 'Pre-event health factor' },
      { name: 'health_factor_after', type: 'NUMERIC(8,4)', nullable: false, description: 'Post-event health factor' },
      { name: 'transaction_hash', type: 'VARCHAR(66)', nullable: true, description: 'On-chain transaction hash' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Event timestamp' }
    ]
  },

  // 5. Orders, Execution & Trades
  {
    tableName: 'orders',
    category: 'TRADING',
    description: 'Algorithmic orders generated by Strategy Engine after passing full Risk Engine evaluation.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['strategy_id REFERENCES strategies(id)', 'organization_id REFERENCES organizations(id)'],
    indexes: ['idx_orders_status_created (status, created_at DESC)'],
    uniqueConstraints: ['UNIQUE(idempotency_key)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Order ID' },
      { name: 'idempotency_key', type: 'VARCHAR(128) UNIQUE', nullable: false, description: 'Cryptographic deduplication hash' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Strategy foreign key' },
      { name: 'order_type', type: 'VARCHAR(50)', nullable: false, description: 'BORROW_AND_SWAP, ARBITRAGE_REBALANCE, REPAY_COLLATERAL' },
      { name: 'expected_notional_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Expected trade size' },
      { name: 'max_slippage_bps', type: 'INTEGER', nullable: false, description: 'Max allowable slippage bps' },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, description: 'CREATED, SIMULATING, APPROVED, SUBMITTED, FILLED, REJECTED, CANCELLED' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Creation timestamp' }
    ]
  },
  {
    tableName: 'trades',
    category: 'TRADING',
    description: 'Executed trade fills with precise slippage, route details, and gas consumption.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['order_id REFERENCES orders(id)', 'market_id REFERENCES markets(id)'],
    indexes: ['idx_trades_order_time (order_id, executed_at DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Trade record ID' },
      { name: 'order_id', type: 'UUID', nullable: false, description: 'Parent order' },
      { name: 'market_id', type: 'UUID', nullable: false, description: 'Market pool' },
      { name: 'amount_in', type: 'NUMERIC(36,18)', nullable: false, description: 'Input token amount' },
      { name: 'amount_out', type: 'NUMERIC(36,18)', nullable: false, description: 'Output token amount received' },
      { name: 'effective_price', type: 'NUMERIC(24,8)', nullable: false, description: 'Actual executed price' },
      { name: 'slippage_incurred_bps', type: 'INTEGER', nullable: false, description: 'Realized slippage bps' },
      { name: 'executed_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Execution timestamp' }
    ]
  },
  {
    tableName: 'transactions',
    category: 'TRADING',
    description: 'On-chain transactions submitted with state machine: SUBMITTED -> CONFIRMED / REVERTED.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['blockchain_id REFERENCES blockchains(id)'],
    indexes: ['idx_txs_chain_hash (blockchain_id, tx_hash UNIQUE)', 'idx_txs_status'],
    uniqueConstraints: ['UNIQUE(blockchain_id, tx_hash)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Transaction record ID' },
      { name: 'blockchain_id', type: 'UUID', nullable: false, description: 'Blockchain foreign key' },
      { name: 'tx_hash', type: 'VARCHAR(66) UNIQUE', nullable: false, description: '0x on-chain transaction hash' },
      { name: 'from_address', type: 'VARCHAR(42)', nullable: false, description: 'Signer wallet / relayer' },
      { name: 'to_contract_address', type: 'VARCHAR(42)', nullable: false, description: 'Target smart contract' },
      { name: 'nonce', type: 'BIGINT', nullable: false, description: 'EVM transaction nonce' },
      { name: 'gas_limit', type: 'BIGINT', nullable: false, description: 'Gas limit specified' },
      { name: 'gas_used', type: 'BIGINT', nullable: true, description: 'Actual gas consumed' },
      { name: 'effective_gas_price_gwei', type: 'NUMERIC(12,4)', nullable: true, description: 'Gas price paid in Gwei' },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, description: 'SUBMITTED, CONFIRMED, REVERTED, SPEED_UP_REPLACED' },
      { name: 'block_number', type: 'BIGINT', nullable: true, description: 'Block height confirmed' }
    ]
  },
  {
    tableName: 'transaction_attempts',
    category: 'TRADING',
    description: 'Simulation traces and gas re-pricing replacement attempts to prevent stuck nonces.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['transaction_id REFERENCES transactions(id) ON DELETE CASCADE'],
    indexes: ['idx_tx_attempts_tx (transaction_id)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Attempt ID' },
      { name: 'transaction_id', type: 'UUID', nullable: false, description: 'Parent transaction' },
      { name: 'attempt_number', type: 'INTEGER', nullable: false, description: 'Retry sequence number' },
      { name: 'simulation_passed', type: 'BOOLEAN', nullable: false, description: 'Fork trace simulation outcome' },
      { name: 'simulation_error_msg', type: 'TEXT', nullable: true, description: 'Revert reason if simulation failed' },
      { name: 'gas_price_gwei', type: 'NUMERIC(12,4)', nullable: false, description: 'Offered gas price' }
    ]
  },
  {
    tableName: 'gas_records',
    category: 'TRADING',
    description: 'Accounting records of all network gas spent across strategies for net yield calculation.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['transaction_id REFERENCES transactions(id)', 'strategy_id REFERENCES strategies(id)'],
    indexes: ['idx_gas_records_strat_time (strategy_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Gas ledger ID' },
      { name: 'transaction_id', type: 'UUID', nullable: false, description: 'Associated transaction' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Charged strategy' },
      { name: 'gas_usd_value', type: 'NUMERIC(18,4)', nullable: false, description: 'USD cost of gas consumed' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Ledger timestamp' }
    ]
  },
  {
    tableName: 'slippage_records',
    category: 'TRADING',
    description: 'Discrepancy logs between quoted and executed DEX swaps for market impact monitoring.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['trade_id REFERENCES trades(id)'],
    indexes: ['idx_slippage_records_time (timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Slippage log ID' },
      { name: 'trade_id', type: 'UUID', nullable: false, description: 'Associated trade' },
      { name: 'quoted_price', type: 'NUMERIC(24,8)', nullable: false, description: 'Expected quote price' },
      { name: 'executed_price', type: 'NUMERIC(24,8)', nullable: false, description: 'Actual filled price' },
      { name: 'slippage_delta_bps', type: 'INTEGER', nullable: false, description: 'Difference in basis points' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Log timestamp' }
    ]
  },

  // 6. Treasury, Accounting & Reserves
  {
    tableName: 'treasury_accounts',
    category: 'TREASURY',
    description: 'Institutional treasury sub-accounts (Operating, Risk Reserve, Cold Storage, Reinvestment).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_treasury_org_type (organization_id, account_type)'],
    uniqueConstraints: ['UNIQUE(organization_id, account_type)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Account ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'account_type', type: 'VARCHAR(50)', nullable: false, description: 'OPERATING_RESERVE, RISK_BUFFER, CORE_TREASURY, STRATEGY_REINVESTMENT' },
      { name: 'target_allocation_pct', type: 'NUMERIC(5,2)', nullable: false, description: 'Configurable governance split percentage' },
      { name: 'current_balance_usd', type: 'NUMERIC(24,4) DEFAULT 0', nullable: false, description: 'Current allocated balance' }
    ]
  },
  {
    tableName: 'treasury_movements',
    category: 'TREASURY',
    description: 'Double-entry cryptographic ledger of all funds routed between vaults and reserves.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['source_account_id REFERENCES treasury_accounts(id)', 'dest_account_id REFERENCES treasury_accounts(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_movements_source_dest (source_account_id, dest_account_id)', 'idx_movements_time (timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Movement record ID' },
      { name: 'source_account_id', type: 'UUID', nullable: false, description: 'Debit account' },
      { name: 'dest_account_id', type: 'UUID', nullable: false, description: 'Credit account' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Asset transferred' },
      { name: 'amount', type: 'NUMERIC(36,18)', nullable: false, description: 'Transfer volume' },
      { name: 'amount_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'USD value equivalent' },
      { name: 'tx_hash', type: 'VARCHAR(66)', nullable: true, description: 'On-chain transaction hash' },
      { name: 'authorized_by', type: 'VARCHAR(150)', nullable: false, description: 'Governance multisig / automated policy rule' },
      { name: 'reason', type: 'TEXT', nullable: false, description: 'Accounting justification' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Ledger entry timestamp' }
    ]
  },
  {
    tableName: 'reserves',
    category: 'TREASURY',
    description: 'Protected reserve assets held in TreasuryVault.sol to absorb market drawdowns.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_reserves_org_token (organization_id, token_id)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Reserve ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Reserve token' },
      { name: 'reserve_bucket', type: 'VARCHAR(50)', nullable: false, description: 'INSURANCE_RISK_POOL, OPERATIONAL_GAS_TANK' },
      { name: 'balance', type: 'NUMERIC(36,18)', nullable: false, description: 'Vault held token amount' },
      { name: 'is_timelocked', type: 'BOOLEAN DEFAULT true', nullable: false, description: 'Protected by 48-hour timelock' }
    ]
  },
  {
    tableName: 'profit_records',
    category: 'TREASURY',
    description: 'Realized strategy net gains after deducting borrow cost, gas, swap slippage, and protocol fees.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['strategy_id REFERENCES strategies(id)', 'trade_id REFERENCES trades(id)'],
    indexes: ['idx_profit_records_strat_time (strategy_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Profit record ID' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Generating strategy' },
      { name: 'trade_id', type: 'UUID', nullable: true, description: 'Triggering trade' },
      { name: 'gross_profit_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Gross gain' },
      { name: 'net_profit_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Net gain after all fees' },
      { name: 'allocated_to_treasury', type: 'BOOLEAN DEFAULT false', nullable: false, description: 'Processed by ProfitDistributor.sol' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Realization timestamp' }
    ]
  },
  {
    tableName: 'loss_records',
    category: 'TREASURY',
    description: 'Realized drawdowns and adverse events tracked for daily loss limits and circuit breakers.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['strategy_id REFERENCES strategies(id)'],
    indexes: ['idx_loss_records_strat_time (strategy_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Loss record ID' },
      { name: 'strategy_id', type: 'UUID', nullable: false, description: 'Affected strategy' },
      { name: 'loss_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Realized loss amount' },
      { name: 'cause_code', type: 'VARCHAR(100)', nullable: false, description: 'SLIPPAGE_EXCEED, DEFENSIVE_UNWIND, BORROW_RATE_SPIKE' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Loss timestamp' }
    ]
  },
  {
    tableName: 'vault_deposits',
    category: 'TREASURY',
    description: 'ERC-4626 TreasuryVault capital deposits with share minting records.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_deposits_org_time (organization_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Deposit ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Asset deposited' },
      { name: 'amount', type: 'NUMERIC(36,18)', nullable: false, description: 'Tokens transferred' },
      { name: 'shares_minted', type: 'NUMERIC(36,18)', nullable: false, description: 'ERC-4626 vault shares minted' },
      { name: 'tx_hash', type: 'VARCHAR(66)', nullable: false, description: 'On-chain deposit hash' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Deposit timestamp' }
    ]
  },
  {
    tableName: 'vault_withdrawals',
    category: 'TREASURY',
    description: 'Timelocked and rate-limited ERC-4626 share redemptions.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)', 'token_id REFERENCES tokens(id)'],
    indexes: ['idx_withdrawals_org_time (organization_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Withdrawal ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'token_id', type: 'UUID', nullable: false, description: 'Asset withdrawn' },
      { name: 'shares_burned', type: 'NUMERIC(36,18)', nullable: false, description: 'ERC-4626 shares redeemed' },
      { name: 'amount_received', type: 'NUMERIC(36,18)', nullable: false, description: 'Underlying tokens received' },
      { name: 'timelock_release_at', type: 'TIMESTAMPTZ', nullable: false, description: 'Timelock expiration' },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, description: 'QUEUED, COMPLETED, CANCELLED' }
    ]
  },

  // 7. Risk Events, Circuit Breakers & Audits
  {
    tableName: 'circuit_breakers',
    category: 'RISK_AUDIT',
    description: 'Automated tripwires (e.g. Oracle Divergence, 30% Volatility Spike, Max Daily Loss).',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_breakers_org_status (organization_id, is_tripped)'],
    uniqueConstraints: ['UNIQUE(organization_id, breaker_type)'],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Breaker ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'breaker_type', type: 'VARCHAR(100)', nullable: false, description: 'ORACLE_DIVERGENCE, MAX_DRAWDOWN, GAS_PRICE_SPIKE, HEALTH_FACTOR_FLOOR' },
      { name: 'threshold_value', type: 'NUMERIC(24,6)', nullable: false, description: 'Tripwire trigger threshold' },
      { name: 'is_tripped', type: 'BOOLEAN DEFAULT false', nullable: false, description: 'Active state' },
      { name: 'tripped_at', type: 'TIMESTAMPTZ', nullable: true, description: 'Trip timestamp' },
      { name: 'reset_by_multisig', type: 'VARCHAR(42)', nullable: true, description: 'Governance signer who reset breaker' }
    ]
  },
  {
    tableName: 'risk_events',
    category: 'RISK_AUDIT',
    description: 'Log of all risk exceptions, rejected orders, and parameter adjustments.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['strategy_id REFERENCES strategies(id)'],
    indexes: ['idx_risk_events_strat_time (strategy_id, timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Risk event ID' },
      { name: 'strategy_id', type: 'UUID', nullable: true, description: 'Affected strategy' },
      { name: 'event_severity', type: 'VARCHAR(20)', nullable: false, description: 'INFO, WARNING, CRITICAL, EMERGENCY_SHUTDOWN' },
      { name: 'decision_code', type: 'VARCHAR(50)', nullable: false, description: 'APPROVED, REJECTED, REDUCE_POSITION, CLOSE_POSITION, EMERGENCY_STOP' },
      { name: 'machine_reasons', type: 'JSONB', nullable: false, description: 'Structured JSON array of mathematical violation reasons' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Timestamp' }
    ]
  },
  {
    tableName: 'liquidation_events',
    category: 'RISK_AUDIT',
    description: 'Defense logs where automated loan protection adjusted collateral or initiated defensive repayments.',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: ['loan_id REFERENCES loans(id)'],
    indexes: ['idx_liq_events_loan (loan_id)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'Liquidation record ID' },
      { name: 'loan_id', type: 'UUID', nullable: false, description: 'Target loan' },
      { name: 'action_taken', type: 'VARCHAR(100)', nullable: false, description: 'EMERGENCY_DELEVERAGE, COLLATERAL_INJECTION, FLASH_REPAY' },
      { name: 'capital_saved_usd', type: 'NUMERIC(24,4)', nullable: false, description: 'Estimated loss prevented' },
      { name: 'tx_hash', type: 'VARCHAR(66)', nullable: true, description: 'Execution hash' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Timestamp' }
    ]
  },
  {
    tableName: 'system_events',
    category: 'RISK_AUDIT',
    description: 'Operational service logs (RPC failover, WebSocket reconnection, Heartbeat checks).',
    primaryKey: 'id (BIGSERIAL)',
    foreignKeys: [],
    indexes: ['idx_system_events_time (timestamp DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'BIGSERIAL PRIMARY KEY', nullable: false, description: 'System event sequence ID' },
      { name: 'service_name', type: 'VARCHAR(100)', nullable: false, description: 'market-data, risk-engine, execution-engine, indexer' },
      { name: 'log_level', type: 'VARCHAR(20)', nullable: false, description: 'DEBUG, INFO, WARN, ERROR, FATAL' },
      { name: 'message', type: 'TEXT', nullable: false, description: 'Log message' },
      { name: 'metadata', type: 'JSONB', nullable: true, description: 'Contextual payload' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Timestamp' }
    ]
  },
  {
    tableName: 'audit_logs',
    category: 'RISK_AUDIT',
    description: 'Immutable, tamper-evident record of all operator actions, parameter mutations, and approvals.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['user_id REFERENCES users(id)'],
    indexes: ['idx_audit_user_time (user_id, timestamp DESC)', 'idx_audit_action'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Audit record ID' },
      { name: 'user_id', type: 'UUID', nullable: true, description: 'Acting user (or SYSTEM)' },
      { name: 'action', type: 'VARCHAR(150)', nullable: false, description: 'SET_RISK_LIMIT, PAUSE_STRATEGY, APPROVE_GATE_4, EMERGENCY_KILL' },
      { name: 'target_entity', type: 'VARCHAR(100)', nullable: false, description: 'Table or contract modified' },
      { name: 'previous_state_hash', type: 'VARCHAR(64)', nullable: false, description: 'SHA-256 state before change' },
      { name: 'new_state_hash', type: 'VARCHAR(64)', nullable: false, description: 'SHA-256 state after change' },
      { name: 'ip_address', type: 'VARCHAR(45)', nullable: true, description: 'Origin IP' },
      { name: 'user_agent', type: 'TEXT', nullable: true, description: 'Client user-agent' },
      { name: 'timestamp', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Commit timestamp' }
    ]
  },
  {
    tableName: 'notifications',
    category: 'RISK_AUDIT',
    description: 'Multi-channel alerting dispatches (Email, Telegram, PagerDuty, Webhook) for risk officers.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['organization_id REFERENCES organizations(id)'],
    indexes: ['idx_notifications_org_time (organization_id, created_at DESC)'],
    uniqueConstraints: [],
    columns: [
      { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false, description: 'Notification ID' },
      { name: 'organization_id', type: 'UUID', nullable: false, description: 'Tenant foreign key' },
      { name: 'channel', type: 'VARCHAR(50)', nullable: false, description: 'PAGERDUTY, TELEGRAM_BOT, WEBSOCKET, EMAIL' },
      { name: 'severity', type: 'VARCHAR(20)', nullable: false, description: 'LOW, MEDIUM, HIGH, EMERGENCY' },
      { name: 'title', type: 'VARCHAR(255)', nullable: false, description: 'Short alert title' },
      { name: 'body', type: 'TEXT', nullable: false, description: 'Full alert body' },
      { name: 'delivered_at', type: 'TIMESTAMPTZ', nullable: true, description: 'Delivery confirmation timestamp' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()', nullable: false, description: 'Creation timestamp' }
    ]
  }
];

export const RAW_SQL_MIGRATION = `
-- ====================================================================
-- PRODUCTION POSTGRESQL SCHEMA MIGRATION: V1.0.0__aegis_quant_core.sql
-- Enterprise DeFi Treasury & Quantitative Risk Platform
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations & Multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    governance_multisig_address VARCHAR(42) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users & RBAC
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mfa_secret_encrypted TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_email UNIQUE(organization_id, email)
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_org_role_name UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    CONSTRAINT uq_role_action_resource UNIQUE(role_id, action, resource)
);

-- 3. Blockchains & Tokens
CREATE TABLE IF NOT EXISTS blockchains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    chain_id BIGINT NOT NULL UNIQUE,
    is_testnet BOOLEAN NOT NULL DEFAULT false,
    primary_rpc_url VARCHAR(500) NOT NULL,
    block_time_seconds NUMERIC(6,2) NOT NULL DEFAULT 12.00
);

CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blockchain_id UUID NOT NULL REFERENCES blockchains(id),
    symbol VARCHAR(30) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    decimals SMALLINT NOT NULL DEFAULT 18,
    oracle_feed_address VARCHAR(42) NOT NULL,
    risk_tier VARCHAR(20) NOT NULL DEFAULT 'TIER_1_BLUECHIP',
    CONSTRAINT uq_chain_contract UNIQUE(blockchain_id, contract_address)
);

CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blockchain_id UUID NOT NULL REFERENCES blockchains(id),
    name VARCHAR(100) NOT NULL,
    protocol_code VARCHAR(50) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    is_governance_approved BOOLEAN NOT NULL DEFAULT false,
    audit_report_hash VARCHAR(66),
    CONSTRAINT uq_chain_protocol UNIQUE(blockchain_id, protocol_code)
);

CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID NOT NULL REFERENCES protocols(id),
    base_token_id UUID NOT NULL REFERENCES tokens(id),
    quote_token_id UUID NOT NULL REFERENCES tokens(id),
    pool_fee_tier_bps INTEGER DEFAULT 30,
    pool_address VARCHAR(42) NOT NULL
);

-- 4. High-Frequency Market Data
CREATE TABLE IF NOT EXISTS price_ticks (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID NOT NULL REFERENCES tokens(id),
    price_usd NUMERIC(24,8) NOT NULL,
    oracle_source VARCHAR(50) NOT NULL,
    confidence_interval NUMERIC(12,6),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_ticks_token_time ON price_ticks (token_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS liquidity_snapshots (
    id BIGSERIAL PRIMARY KEY,
    market_id UUID NOT NULL REFERENCES markets(id),
    total_liquidity_usd NUMERIC(28,4) NOT NULL,
    available_borrow_capacity_usd NUMERIC(28,4),
    utilization_rate_pct NUMERIC(6,3),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liquidity_market_time ON liquidity_snapshots (market_id, timestamp DESC);

-- 5. Quantitative Strategies & Risk Constraints
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    strategy_code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
    onchain_registry_address VARCHAR(42),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_strat_code UNIQUE(organization_id, strategy_code)
);

CREATE TABLE IF NOT EXISTS risk_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    max_leverage NUMERIC(4,2) NOT NULL DEFAULT 2.50,
    max_ltv_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
    min_health_factor NUMERIC(6,3) NOT NULL DEFAULT 1.350,
    liquidation_buffer_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    max_position_size_usd NUMERIC(24,2) NOT NULL DEFAULT 250000.00,
    max_daily_loss_usd NUMERIC(24,2) NOT NULL DEFAULT 10000.00,
    max_slippage_bps INTEGER NOT NULL DEFAULT 30,
    max_gas_price_gwei INTEGER NOT NULL DEFAULT 65,
    CONSTRAINT uq_strat_risk UNIQUE(strategy_id)
);

-- 6. Collateralized Debt Positions & Loans
CREATE TABLE IF NOT EXISTS collateral_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    protocol_id UUID NOT NULL REFERENCES protocols(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    deposited_amount NUMERIC(36,18) NOT NULL,
    market_value_usd NUMERIC(24,4) NOT NULL,
    liquidation_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 85.00
);

CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collateral_position_id UUID NOT NULL REFERENCES collateral_positions(id) ON DELETE CASCADE,
    debt_token_id UUID NOT NULL REFERENCES tokens(id),
    principal_debt NUMERIC(36,18) NOT NULL,
    accrued_interest NUMERIC(36,18) NOT NULL DEFAULT 0,
    total_debt_usd NUMERIC(24,4) NOT NULL,
    current_ltv_pct NUMERIC(5,2) NOT NULL,
    health_factor NUMERIC(8,4) NOT NULL,
    borrow_apr_pct NUMERIC(6,3) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_loans_hf ON loans(health_factor);

-- 7. Orders, Trades & Transactions
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    order_type VARCHAR(50) NOT NULL,
    expected_notional_usd NUMERIC(24,4) NOT NULL,
    max_slippage_bps INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blockchain_id UUID NOT NULL REFERENCES blockchains(id),
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    from_address VARCHAR(42) NOT NULL,
    to_contract_address VARCHAR(42) NOT NULL,
    nonce BIGINT NOT NULL,
    gas_limit BIGINT NOT NULL,
    gas_used BIGINT,
    effective_gas_price_gwei NUMERIC(12,4),
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    block_number BIGINT
);

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    amount_in NUMERIC(36,18) NOT NULL,
    amount_out NUMERIC(36,18) NOT NULL,
    effective_price NUMERIC(24,8) NOT NULL,
    slippage_incurred_bps INTEGER NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Treasury Reserves & Accounting
CREATE TABLE IF NOT EXISTS treasury_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    account_type VARCHAR(50) NOT NULL,
    target_allocation_pct NUMERIC(5,2) NOT NULL,
    current_balance_usd NUMERIC(24,4) NOT NULL DEFAULT 0,
    CONSTRAINT uq_org_account_type UNIQUE(organization_id, account_type)
);

CREATE TABLE IF NOT EXISTS treasury_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_account_id UUID NOT NULL REFERENCES treasury_accounts(id),
    dest_account_id UUID NOT NULL REFERENCES treasury_accounts(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount NUMERIC(36,18) NOT NULL,
    amount_usd NUMERIC(24,4) NOT NULL,
    tx_hash VARCHAR(66),
    authorized_by VARCHAR(150) NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    trade_id UUID REFERENCES trades(id),
    gross_profit_usd NUMERIC(24,4) NOT NULL,
    net_profit_usd NUMERIC(24,4) NOT NULL,
    allocated_to_treasury BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Circuit Breakers, Risk Events & Audit Trail
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    breaker_type VARCHAR(100) NOT NULL,
    threshold_value NUMERIC(24,6) NOT NULL,
    is_tripped BOOLEAN NOT NULL DEFAULT false,
    tripped_at TIMESTAMPTZ,
    reset_by_multisig VARCHAR(42),
    CONSTRAINT uq_org_breaker UNIQUE(organization_id, breaker_type)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(150) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    previous_state_hash VARCHAR(64) NOT NULL,
    new_state_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC);
`;
