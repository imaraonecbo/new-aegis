import { getPublicClient } from '../chain/client';
import { AAVE_V3 } from '../chain/constants';

// Aave V3 IPool.getReserveData ABI (the return struct, unabridged).
// Rates are in "ray" units (1e27) per Aave convention.
const AAVE_POOL_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'asset', type: 'address' }],
    name: 'getReserveData',
    outputs: [
      {
        components: [
          {
            components: [{ internalType: 'uint256', name: 'data', type: 'uint256' }],
            internalType: 'struct DataTypes.ReserveConfigurationMap',
            name: 'configuration',
            type: 'tuple',
          },
          { internalType: 'uint128', name: 'liquidityIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'currentLiquidityRate', type: 'uint128' },
          { internalType: 'uint128', name: 'variableBorrowIndex', type: 'uint128' },
          { internalType: 'uint128', name: 'currentVariableBorrowRate', type: 'uint128' },
          { internalType: 'uint128', name: 'currentStableBorrowRate', type: 'uint128' },
          { internalType: 'uint40', name: 'lastUpdateTimestamp', type: 'uint40' },
          { internalType: 'uint16', name: 'id', type: 'uint16' },
          { internalType: 'address', name: 'aTokenAddress', type: 'address' },
          { internalType: 'address', name: 'stableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
          { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' },
        ],
        internalType: 'struct DataTypes.ReserveData',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const RAY = 10n ** 27n;

export interface AaveRates {
  asset: `0x${string}`;
  /** Simple APR from the current per-second rate, as a percentage. This is
   * NOT the fully-compounded APY Aave's own UI shows — good enough to spot
   * a borrow-vs-arb opportunity, not precise enough to size a real position. */
  supplyAprPct: number;
  variableBorrowAprPct: number;
}

export async function getAaveRates(asset: `0x${string}`): Promise<AaveRates> {
  const client = getPublicClient();

  const data = await client.readContract({
    address: AAVE_V3.pool as `0x${string}`,
    abi: AAVE_POOL_ABI,
    functionName: 'getReserveData',
    args: [asset],
  });

  const currentLiquidityRate = data.currentLiquidityRate as bigint;
  const currentVariableBorrowRate = data.currentVariableBorrowRate as bigint;

  // rate (ray, per-second-compounding basis per Aave convention) -> percentage
  const toPct = (rayRate: bigint) => Number((rayRate * 10000n) / RAY) / 100;

  return {
    asset,
    supplyAprPct: toPct(currentLiquidityRate),
    variableBorrowAprPct: toPct(currentVariableBorrowRate),
  };
}
