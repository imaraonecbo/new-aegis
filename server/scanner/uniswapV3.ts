import { getPublicClient } from '../chain/client';
import { UNISWAP_V3 } from '../chain/constants';

// Minimal ABI fragment — only the one function we need.
// NOTE: quoteExactInputSingle is declared non-view in Solidity (it writes
// then reverts to extract the result), but calling it via readContract/
// eth_call is safe and standard — no state is ever actually persisted,
// and no transaction is broadcast.
const QUOTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export interface UniswapQuote {
  venue: 'UniswapV3';
  feeTier: number;
  amountOut: bigint;
  error?: string;
}

async function quoteOne(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
  amountIn: bigint
): Promise<UniswapQuote> {
  const client = getPublicClient();
  try {
    const amountOut = await client.readContract({
      address: UNISWAP_V3.quoter as `0x${string}`,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [tokenIn, tokenOut, fee, amountIn, 0n],
    });
    return { venue: 'UniswapV3', feeTier: fee, amountOut };
  } catch (err: any) {
    return {
      venue: 'UniswapV3',
      feeTier: fee,
      amountOut: 0n,
      error: err?.shortMessage || err?.message || 'no pool / no liquidity',
    };
  }
}

/** Quotes tokenIn -> tokenOut across all standard fee tiers, at one size. */
export async function getUniswapV3Quotes(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint
): Promise<UniswapQuote[]> {
  return Promise.all(UNISWAP_V3.feeTiers.map((fee) => quoteOne(tokenIn, tokenOut, fee, amountIn)));
}

export interface DepthProbeResult {
  feeTier: number;
  /** price per 1 unit of tokenIn, at each probed size — should be near-flat for real liquidity */
  pricePerUnitBySize: { sizeUnits: number; pricePerUnit: number }[];
  /** % degradation from smallest to largest probe size. High = thin pool, don't trust the headline quote. */
  priceImpactPct: number | null; // null if we couldn't get quotes at 2+ sizes
}

/** Probes a pool at multiple sizes to see whether its price is stable (real,
 * tradeable liquidity) or collapses as size increases (thin/illiquid pool —
 * exactly the failure mode that produces a fake-looking "spread"). */
export async function probeUniswapV3Depth(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
  probeSizesUnits: number[], // e.g. [0.01, 0.1, 1] (in tokenIn's human units)
  tokenInDecimals: number,
  tokenOutDecimals: number
): Promise<DepthProbeResult> {
  const points: { sizeUnits: number; pricePerUnit: number }[] = [];

  for (const size of probeSizesUnits) {
    const amountIn = BigInt(Math.floor(size * 10 ** tokenInDecimals));
    const q = await quoteOne(tokenIn, tokenOut, fee, amountIn);
    if (!q.error && q.amountOut > 0n) {
      const amountOutHuman = Number(q.amountOut) / 10 ** tokenOutDecimals;
      points.push({ sizeUnits: size, pricePerUnit: amountOutHuman / size });
    }
  }

  let priceImpactPct: number | null = null;
  if (points.length >= 2) {
    const smallest = points[0].pricePerUnit;
    const largest = points[points.length - 1].pricePerUnit;
    priceImpactPct = ((smallest - largest) / smallest) * 100;
  }

  return { feeTier: fee, pricePerUnitBySize: points, priceImpactPct };
}
