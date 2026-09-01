// ============================================================================
// CAMELOT — TEMPORARILY DISABLED
// ============================================================================
// The V2-style router this file previously called is quoting against what
// is very likely a near-abandoned legacy pool. Camelot now runs V2, V3, AND
// V4 AMMs (confirmed via their own docs) - real liquidity for majors has
// almost certainly migrated off V2. Live evidence: it returned a "spread"
// of 200,461% against WBTC/USDC, which is not a real price under any
// circumstance - it's a broken integration.
//
// Re-enabling this requires: (1) confirming which AMM version actually
// holds real liquidity for each pair (their subgraph or UI, not a guess),
// (2) the correct ABI for that version's quoter (Algebra's V3 interface
// differs from Uniswap's - no fee param, dynamic fees per pool), and
// (3) testing the result against a known-good reference price before
// trusting it again.
//
// Until then this returns a stub error so the scanner correctly reports
// venues=2 (Uniswap only) instead of a fabricated third data point.

export interface CamelotQuote {
  venue: 'Camelot';
  amountOut: bigint;
  error?: string;
}

export async function getCamelotQuote(
  _tokenIn: `0x${string}`,
  _tokenOut: `0x${string}`,
  _amountIn: bigint
): Promise<CamelotQuote> {
  return { venue: 'Camelot', amountOut: 0n, error: 'disabled pending V2/V3/V4 verification' };
}
