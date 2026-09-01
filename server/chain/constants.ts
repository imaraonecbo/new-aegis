// ============================================================================
// ARBITRUM ONE — VERIFIED CONTRACT ADDRESSES
// ============================================================================
// Every address below was checked against Arbiscan / official docs on the
// date this file was written. DO NOT trust addresses from memory or from
// an LLM without checking — a wrong address here either fails loudly (bad)
// or silently returns garbage data (worse). Re-verify before using with
// real funds: https://arbiscan.io + the project's own docs.
//
// Chain: Arbitrum One, chainId 42161

export const CHAIN_ID = 42161;

// Public, free, no-API-key RPC endpoints. Rotate through these — public
// endpoints rate-limit and occasionally go down. For anything beyond
// dev/scanning (i.e. once you're submitting real transactions) you'll
// want a paid RPC (Alchemy/Infura/QuickNode free tier is fine to start),
// but none of that is needed for this read-only stage.
export const PUBLIC_RPC_URLS = [
  'https://arb1.arbitrum.io/rpc',       // Arbitrum Foundation's own public RPC
  'https://arbitrum-one.public.blastapi.io',
  'https://rpc.ankr.com/arbitrum',
] as const;

// ---- Tokens -----------------------------------------------------------
export const TOKENS = {
  WETH: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    symbol: 'WETH',
  },
  USDC: {
    // Circle-issued NATIVE USDC (not the bridged USDC.e below).
    // These are two different ERC-20 contracts with different liquidity —
    // mixing them up will make your spread calculations meaningless.
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    symbol: 'USDC',
  },
  'USDC.e': {
    // Bridged (legacy) USDC from Ethereum via the Arbitrum canonical bridge.
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    symbol: 'USDC.e',
  },
  WBTC: {
    address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    decimals: 8,
    symbol: 'WBTC',
  },
  ARB: {
    // Arbitrum's own governance token — the Arbitrum Foundation's official contract.
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    symbol: 'ARB',
  },
} as const;

// ---- Uniswap V3 --------------------------------------------------------
export const UNISWAP_V3 = {
  factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  // Original Quoter (not QuoterV2). Its quote functions are marked
  // non-view in Solidity but are gas-estimation-only — safe to call via
  // eth_call (readContract) since we never broadcast the tx.
  quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  // Standard fee tiers, in hundredths of a bip (500 = 0.05%, 3000 = 0.3%).
  // The 1% tier (10000) was tested live on 2026-08-31 and confirmed to have
  // near-zero real liquidity for WETH/USDC on Arbitrum — quoting it produced
  // a persistent, unmoving "spread" that shrank ~50% just from cutting test
  // size 10x, the signature of thin-pool price impact, not a real market.
  // Excluded to avoid generating false-looking opportunities.
  feeTiers: [500, 3000] as const,
};

// ---- Camelot (Arbitrum-native DEX, V2-style AMM router) ----------------
export const CAMELOT = {
  router: '0xc873fecbd354f5a56e00e710b90ef4201db2448d',
};

// ---- Aave V3 -------------------------------------------------------------
export const AAVE_V3 = {
  pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
};
