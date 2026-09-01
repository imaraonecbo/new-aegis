import { getPublicClient } from '../chain/client';
import { TOKENS } from '../chain/constants';
import { getUniswapV3Quotes, probeUniswapV3Depth } from './uniswapV3';
import { getCamelotQuote } from './camelot';
import { getAaveRates } from './aave';

// ============================================================================
// Finds price differences between venues for a given base/USDC pair and
// reports them net of estimated gas. It executes NOTHING — no wallet, no
// signer, no transaction ever leaves this process. Its only job is to tell
// you, honestly, whether real opportunities exist and how big they are
// before either of us writes a line of execution code.
// ============================================================================

export interface TokenInfo {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
}

interface VenueQuote {
  venue: string;
  amountOutUsdc: number;
  uniFeeTier?: number;
}

export interface ScanResult {
  pairSymbol: string;
  timestamp: string;
  testSizeBase: number;
  quotes: VenueQuote[];
  bestBuyVenue: string;
  bestSellVenue: string;
  grossSpreadUsd: number;
  grossSpreadPct: number;
  estGasCostUsd: number;
  netProfitUsd: number;
  isRealOpportunity: boolean;
  isThinLiquidity: boolean;
  isImplausible: boolean; // spread exceeds any sane real-world bound - integration bug, not a market
  priceImpactWarning?: string;
  aaveBorrowAprPct: number;
}

const MAX_ACCEPTABLE_PRICE_IMPACT_PCT = 1.0;

// Conservative placeholder until we have a real flash-loan-arb contract to
// measure against. An Aave-flash-loan + 2-swap arbitrage typically runs
// 350k-600k gas on Arbitrum; we use the high end to avoid false positives.
const ESTIMATED_GAS_UNITS = 600_000n;

// Require the edge to clear gas by a margin before calling it "real" -
// quotes are stale by the time you could act on them (block time, mempool
// visibility, MEV competitors), so a razor-thin net-positive number is not
// something you should trust or act on.
const MIN_EDGE_USD = 5;

// Hard sanity ceiling, independent of everything else. A real cross-venue
// spread on liquid pairs is a fraction of a percent to low single digits.
// Anything above this is not "a great opportunity" - it's a broken quote,
// wrong decimals, wrong contract, or a near-dead pool. Live evidence for
// why this exists: a mis-wired venue integration produced a 200,461%
// "spread" that would otherwise have shown up green. Reject it outright,
// don't just flag it - a plausible-looking wrong number is more dangerous
// than an obviously-broken one.
const MAX_PLAUSIBLE_SPREAD_PCT = 15;

export async function scanPair(base: TokenInfo, testSizeBase: number): Promise<ScanResult> {
  const client = getPublicClient();
  const usdc = TOKENS.USDC;
  const amountIn = BigInt(Math.floor(testSizeBase * 10 ** base.decimals));

  const [uniQuotes, camelotQuote, gasPrice, aaveRates] = await Promise.all([
    getUniswapV3Quotes(base.address, usdc.address as `0x${string}`, amountIn),
    getCamelotQuote(base.address, usdc.address as `0x${string}`, amountIn),
    client.getGasPrice(),
    getAaveRates(base.address),
  ]);

  const quotes: VenueQuote[] = [];

  for (const q of uniQuotes) {
    if (!q.error && q.amountOut > 0n) {
      quotes.push({
        venue: `UniswapV3 (${q.feeTier / 10000}%)`,
        amountOutUsdc: Number(q.amountOut) / 10 ** usdc.decimals,
        uniFeeTier: q.feeTier,
      });
    }
  }
  if (!camelotQuote.error && camelotQuote.amountOut > 0n) {
    quotes.push({
      venue: 'Camelot',
      amountOutUsdc: Number(camelotQuote.amountOut) / 10 ** usdc.decimals,
    });
  }

  const resultDefaults = {
    pairSymbol: `${base.symbol}/USDC`,
    timestamp: new Date().toISOString(),
    testSizeBase,
    aaveBorrowAprPct: aaveRates.variableBorrowAprPct,
  };

  if (quotes.length < 2) {
    return {
      ...resultDefaults,
      quotes,
      bestBuyVenue: quotes[0]?.venue ?? 'none',
      bestSellVenue: quotes[0]?.venue ?? 'none',
      grossSpreadUsd: 0,
      grossSpreadPct: 0,
      estGasCostUsd: 0,
      netProfitUsd: 0,
      isRealOpportunity: false,
      isThinLiquidity: false,
      isImplausible: false,
    };
  }

  const sorted = [...quotes].sort((a, b) => a.amountOutUsdc - b.amountOutUsdc);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  const grossSpreadUsd = best.amountOutUsdc - worst.amountOutUsdc;
  const grossSpreadPct = (grossSpreadUsd / worst.amountOutUsdc) * 100;

  // Gas is always paid in ETH regardless of which token is traded, so we
  // need an ETH/USD reference specifically, not base's own price. For WETH
  // pairs this is free (the quote itself gives it to us). For non-WETH
  // pairs, this is an approximation until we wire a proper ETH price feed
  // (Chainlink, or a parallel WETH/USDC quote) - flagged, not silently wrong.
  const ethUsdPriceApprox = base.symbol === 'WETH' ? best.amountOutUsdc / testSizeBase : null;
  const estGasCostUsd = ethUsdPriceApprox
    ? (Number(gasPrice * ESTIMATED_GAS_UNITS) / 1e18) * ethUsdPriceApprox
    : 0.05; // rough flat fallback for non-WETH pairs until a real ETH price source is wired in

  const netProfitUsd = grossSpreadUsd - estGasCostUsd;

  let isThinLiquidity = false;
  let priceImpactWarning: string | undefined;

  // Probe sizes scale to THIS pair's actual test size (10%, 50%, 100% of it) -
  // NOT a fixed absolute number. A fixed size that's economically meaningful
  // for WETH (~$2,250/unit) is meaningless for ARB (~$0.11/unit) or WBTC
  // (~$75,000/unit) - that mismatch is exactly what let a fake ARB "opportunity"
  // through: probing 0.01-1 ARB tests whether a pool can fill an 11-cent trade,
  // which tells you nothing about whether it can fill the real $220 test size.
  const depthProbeSizes = [testSizeBase * 0.1, testSizeBase * 0.5, testSizeBase];

  for (const leg of [worst, best]) {
    if (leg.uniFeeTier === undefined) continue;
    const probe = await probeUniswapV3Depth(
      base.address,
      usdc.address as `0x${string}`,
      leg.uniFeeTier,
      depthProbeSizes,
      base.decimals,
      usdc.decimals
    );
    if (probe.priceImpactPct !== null && probe.priceImpactPct > MAX_ACCEPTABLE_PRICE_IMPACT_PCT) {
      isThinLiquidity = true;
      priceImpactWarning =
        `${leg.venue}: price degrades ${probe.priceImpactPct.toFixed(2)}% between ` +
        `${depthProbeSizes[0].toFixed(6)} and ${depthProbeSizes[depthProbeSizes.length - 1]} ${base.symbol} ` +
        `- this pool likely can't fill your test size at the quoted price. Not a real opportunity.`;
    }
  }

  return {
    ...resultDefaults,
    quotes,
    bestBuyVenue: worst.venue,
    bestSellVenue: best.venue,
    grossSpreadUsd,
    grossSpreadPct,
    estGasCostUsd,
    netProfitUsd,
    isRealOpportunity:
      netProfitUsd > MIN_EDGE_USD && !isThinLiquidity && grossSpreadPct <= MAX_PLAUSIBLE_SPREAD_PCT,
    isThinLiquidity,
    isImplausible: grossSpreadPct > MAX_PLAUSIBLE_SPREAD_PCT,
    priceImpactWarning,
  };
}
