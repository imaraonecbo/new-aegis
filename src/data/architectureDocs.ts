export const ARCHITECTURE_SPEC = {
  title: 'AegisQuant Institutional DeFi SaaS Platform Architecture',
  version: '1.0.0-PROD_SPEC',
  coreTenet: 'Non-custodial, Zero-Trust, Invariant-Gated Capital Preservation with Verifiable Cryptographic Accounting',
  
  services: [
    { id: 1, name: 'Web Frontend', tech: 'Next.js 15 / React 19 + TypeScript + Tailwind CSS', role: 'Institutional command console, risk visualizations, and multisig proposal interface.' },
    { id: 2, name: 'Authentication / IAM', tech: 'OAuth 2.0 / OIDC + TOTP MFA + Argon2id', role: 'Granular RBAC with separation of duties between Quants, Risk Officers, and Treasury Admins.' },
    { id: 3, name: 'User / Account Service', tech: 'Node.js / Express + PostgreSQL', role: 'Organization hierarchy, audit metadata, notification routing preferences.' },
    { id: 4, name: 'Market-Data Ingestion', tech: 'Rust / Go / TypeScript WebSocket Feed', role: 'High-frequency oracle aggregation (Chainlink + Pyth + Uniswap TWAP) with cross-feed anomaly detectors.' },
    { id: 5, name: 'Quantitative / Risk Engine', tech: 'Python (NumPy / SciPy / Pandas)', role: 'Solvency checks, Health Factor forecasting, parametric VaR, stress-testing, and invariant proofs.' },
    { id: 6, name: 'Strategy Engine', tech: 'Python / TypeScript State Machine', role: 'Deterministic signal evaluation for delta-neutral arbitrage and collateralized yield farming.' },
    { id: 7, name: 'Portfolio Service', tech: 'TypeScript + PostgreSQL + Redis', role: 'Real-time aggregate position tracking, mark-to-market valuations, and cost basis accounting.' },
    { id: 8, name: 'DeFi Integration Layer', tech: 'Viem / Ethers.js + TypeChain Adapters', role: 'Abstracted ILendingAdapter, IDexAdapter, IOracleAdapter, IBlockchainAdapter.' },
    { id: 9, name: 'Transaction Simulation Service', tech: 'EVM Local Fork Tracer (Anvil / Hardhat)', role: 'Pre-flight trace execution, gas profiling, reentrancy guards, and state revert detection.' },
    { id: 10, name: 'Trading / Execution Engine', tech: 'Event-driven Node.js Pipeline + BullMQ', role: 'Idempotent 11-step execution pipeline from Signal to Cryptographic Audit Record.' },
    { id: 11, name: 'Loan / Position Manager', tech: 'TypeScript Engine + PositionManager.sol', role: 'Collateral ratio tracking, debt interest accrual, flash-loan defense, and automated deleveraging.' },
    { id: 12, name: 'Treasury Service', tech: 'TypeScript Engine + TreasuryVault.sol', role: 'Configurable 4-tier profit routing (Operating, Risk Reserve, Cold Treasury, Reinvestment).' },
    { id: 13, name: 'Blockchain Indexer', tech: 'Custom Rust / Viem Subgraph Indexer', role: 'Real-time block listening, reorg detection (6-block confirmation depth), event reconciliation.' },
    { id: 14, name: 'Notification Service', tech: 'Go / Node.js + PagerDuty / Telegram / Webhook', role: 'Urgent risk alerts for Health Factor drops, oracle deviations, or circuit breaker trips.' },
    { id: 15, name: 'Audit & Compliance Service', tech: 'PostgreSQL Append-Only Ledger + SHA-256 Hashes', role: 'Tamper-evident logs of all mutations, risk evaluations, and execution attempts.' },
    { id: 16, name: 'Admin / Risk Dashboard', tech: 'React 19 + Recharts + Motion', role: 'Interactive killswitch console, stress test sliders, gate transition authorizer.' },
    { id: 17, name: 'Monitoring & Observability', tech: 'Prometheus + Grafana + OpenTelemetry', role: 'Distributed tracing, RPC latency, gas price heatmaps, memory leaks, and uptime metrics.' }
  ],

  monorepoStructure: [
    { path: '/apps/web', responsibility: 'Next.js / React institutional SaaS user interface and risk management console.' },
    { path: '/apps/api', responsibility: 'Express / Fastify REST and WebSocket Gateway with OpenAPI 3.0 documentation.' },
    { path: '/apps/admin', responsibility: 'Restricted administrative and governance multisig execution portal.' },
    { path: '/services/market-data', responsibility: 'WebSocket listeners for multi-DEX pools, Chainlink nodes, and Pyth oracle streams.' },
    { path: '/services/risk-engine', responsibility: 'Python quantitative service enforcing mathematical solvency and VaR invariants.' },
    { path: '/services/strategy-engine', responsibility: 'Signal generator for allowlisted quantitative trading algorithms.' },
    { path: '/services/execution-engine', responsibility: 'Idempotent transaction submission with gas optimization and MEV protection.' },
    { path: '/services/indexer', responsibility: 'Blockchain event consumer indexing deposit, borrow, repay, and swap logs.' },
    { path: '/contracts', responsibility: 'Solidity contracts, Foundry test suites, Slither analyzers, and deployment scripts.' },
    { path: '/packages/types', responsibility: 'Shared TypeScript interfaces, Zod schemas, and protocol type definitions.' },
    { path: '/packages/database', responsibility: 'PostgreSQL Drizzle/Prisma schema definitions and idempotent SQL migrations.' },
    { path: '/packages/config', responsibility: 'Chain constants, RPC failover configs, protocol addresses, and risk ceilings.' },
    { path: '/packages/security', responsibility: 'AES-256 encryption helpers, HMAC signing, and JWT validation utilities.' },
    { path: '/packages/blockchain', responsibility: 'Viem-based adapters for Aave V3, Uniswap V3, Chainlink, and Safe contracts.' },
    { path: '/packages/api-client', responsibility: 'Typed SDK client for frontend-backend communication.' },
    { path: '/quant/strategies', responsibility: 'Backtested algorithmic models (Delta-neutral basis, Yield harvest, Rebalancer).' },
    { path: '/quant/backtesting', responsibility: 'Event-driven backtesting engine with slippage models and look-ahead bias prevention.' },
    { path: '/quant/risk', responsibility: 'Mathematical formulas, Monte Carlo stress simulators, and portfolio variance matrices.' },
    { path: '/infrastructure/docker', responsibility: 'Multi-stage Dockerfiles and docker-compose.yml for local and production deployment.' },
    { path: '/infrastructure/terraform', responsibility: 'GCP Cloud Run / AWS ECS, Cloud SQL PostgreSQL, and Redis provisioning scripts.' },
    { path: '/infrastructure/monitoring', responsibility: 'Prometheus alert rules, Grafana dashboard JSONs, and OpenTelemetry collector configs.' },
    { path: '/tests', responsibility: 'End-to-end integration tests, failure injection suites, and security fuzzers.' },
    { path: '/docs', responsibility: 'OpenAPI specs, threat model documents, invariant catalogs, and runbooks.' }
  ],

  productionGates: [
    {
      number: 1,
      name: 'Unit & Integration Suite Pass',
      capUsd: 0,
      description: '100% test pass rate across mathematical risk modules, database models, and API endpoints.',
      status: 'PASSED'
    },
    {
      number: 2,
      name: 'Backtesting & Risk Model Validation',
      capUsd: 0,
      description: 'Historical backtests demonstrate Sharpe > 1.80 and Max Drawdown < 12.0% across 365 days with zero liquidation events.',
      status: 'PASSED'
    },
    {
      number: 3,
      name: 'Smart Contract Invariant & Fuzz Tests',
      capUsd: 0,
      description: 'Foundry invariant tests (100,000 runs) and Slither static analysis pass with 0 high/medium vulnerabilities.',
      status: 'PASSED'
    },
    {
      number: 4,
      name: 'Testnet Sandbox Fork Validation',
      capUsd: 1000,
      description: 'Automated execution runs continuously on Sepolia/Arbitrum Sepolia for 14 days without state anomalies.',
      status: 'IN_PROGRESS'
    },
    {
      number: 5,
      name: 'Independent Security Audit & Threat Review',
      capUsd: 10000,
      description: 'Formal verification of TreasuryVault and RiskController contracts with zero critical findings.',
      status: 'PENDING'
    },
    {
      number: 6,
      name: 'Staging Environment Simulation',
      capUsd: 50000,
      description: 'Full multi-container cluster deployment executing with simulated real-world RPC lag and failover.',
      status: 'PENDING'
    },
    {
      number: 7,
      name: 'Human Governance Multisig Real-Capital Signoff',
      capUsd: 250000,
      description: 'Explicit 3-of-5 Gnosis Safe cryptographic authorization required before production capital escalation.',
      status: 'PENDING'
    }
  ]
};
