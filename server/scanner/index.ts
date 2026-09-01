import { ethers } from "ethers";

// Arbitrum One RPC Provider (Fallbacks to public RPC if env not set)
const PROVIDER_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Official Arbitrum One Factory & Token Addresses
const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const CAMELOT_V3_FACTORY = "0x1a3c9b1d2f0529d97f2afc5136cc23e58f1FD35B";

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";

// Minimal ABIs for Factory and Pool Interrogation
const UNI_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const CAMELOT_FACTORY_ABI = [
  "function poolByPair(address tokenA, address tokenB) external view returns (address pool)"
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

export async function runScannerTick() {
  console.log("[Scanner] Connecting to Arbitrum One RPC to fetch live pool reserves...");
  
  try {
    const uniFactory = new ethers.Contract(UNISWAP_V3_FACTORY, UNI_FACTORY_ABI, provider);
    const camelotFactory = new ethers.Contract(CAMELOT_V3_FACTORY, CAMELOT_FACTORY_ABI, provider);

    // Query WETH/USDC 0.05% fee tier on Uniswap V3 & Algebra/Camelot V3
    const uniPoolAddress = await uniFactory.getPool(WETH, USDC, 500);
    const camelotPoolAddress = await camelotFactory.poolByPair(WETH, USDC);

    console.log("[Scanner] Uniswap V3 WETH/USDC Pool:", uniPoolAddress);
    console.log("[Scanner] Camelot V3 WETH/USDC Pool:", camelotPoolAddress);

    let uniPrice = 0;
    let camelotPrice = 0;
    const Q96 = 2n ** 96n;

    if (uniPoolAddress && uniPoolAddress !== ethers.ZeroAddress) {
      const uniPool = new ethers.Contract(uniPoolAddress, POOL_ABI, provider);
      const slot0 = await uniPool.slot0();
      const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());
      // Price calculation for token1/token0 considering decimal difference (WETH: 18, USDC: 6)
      const priceScaled = (sqrtPriceX96 * sqrtPriceX96 * 10n**12n) / (Q96 * Q96);
      uniPrice = Number(priceScaled) / 1e18;
      console.log("[Scanner] Uniswap V3 WETH/USDC Spot Price:", uniPrice.toFixed(2));
    }

    if (camelotPoolAddress && camelotPoolAddress !== ethers.ZeroAddress) {
      const camelotPool = new ethers.Contract(camelotPoolAddress, POOL_ABI, provider);
      const slot0 = await camelotPool.slot0();
      const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());
      const priceScaled = (sqrtPriceX96 * sqrtPriceX96 * 10n**12n) / (Q96 * Q96);
      camelotPrice = Number(priceScaled) / 1e18;
      console.log("[Scanner] Camelot V3 WETH/USDC Spot Price:", camelotPrice.toFixed(2));
    }

    if (uniPrice > 0 && camelotPrice > 0) {
      const spread = Math.abs(uniPrice - camelotPrice);
      console.log(`[Scanner] Live Cross-Venue Spread: ${spread.toFixed(2)} per WETH`);
    }

  } catch (err: any) {
    console.error("[Scanner Error] Live on-chain fetch failed:", err.message);
  }
}
