import { ethers } from "ethers";

const PROVIDER_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const EXECUTOR_CONTRACT = process.env.EXECUTOR_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const CAMELOT_V3_FACTORY = "0x1a3c9b1d2f0529d97f2afc5136cc23e58f1FD35B";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";

const UNI_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];
const CAMELOT_FACTORY_ABI = [
  "function poolByPair(address tokenA, address tokenB) external view returns (address pool)"
];
const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)"
];
const EXECUTOR_ABI = [
  "function executeArbitrage(address tokenBorrow, uint256 amountBorrow, address routerA, address routerB, bytes calldata data) external"
];

export async function runExecutionBridge() {
  console.log("[ExecutionBridge] Scanning live Arbitrum One pools for executable arbitrage...");

  try {
    const uniFactory = new ethers.Contract(UNISWAP_V3_FACTORY, UNI_FACTORY_ABI, provider);
    const camelotFactory = new ethers.Contract(CAMELOT_V3_FACTORY, CAMELOT_FACTORY_ABI, provider);

    const uniPoolAddr = await uniFactory.getPool(WETH, USDC, 500);
    const camelotPoolAddr = await camelotFactory.poolByPair(WETH, USDC);

    if (uniPoolAddr === ethers.ZeroAddress || camelotPoolAddr === ethers.ZeroAddress) {
      console.log("[ExecutionBridge] Pools not fully initialized. Skipping tick.");
      return;
    }

    const uniPool = new ethers.Contract(uniPoolAddr, POOL_ABI, provider);
    const camelotPool = new ethers.Contract(camelotPoolAddr, POOL_ABI, provider);

    const [uniSlot, camelotSlot] = await Promise.all([uniPool.slot0(), camelotPool.slot0()]);
    
    const Q96 = 2n ** 96n;
    const decodePrice = (sqrtPriceX96: bigint) => {
      const priceScaled = (sqrtPriceX96 * sqrtPriceX96 * 10n**12n) / (Q96 * Q96);
      return Number(priceScaled) / 1e18;
    };

    const uniPrice = decodePrice(BigInt(uniSlot[0].toString()));
    const camelotPrice = decodePrice(BigInt(camelotSlot[0].toString()));
    const spread = Math.abs(uniPrice - camelotPrice);

    console.log([Metrics] Uniswap: \server/scanner/index.ts{uniPrice.toFixed(2)} | Camelot: \server/scanner/index.ts{camelotPrice.toFixed(2)} | Spread: \server/scanner/index.ts{spread.toFixed(2)});

    // Minimum net profit threshold set to .00 to cover flash loan fee + gas buffer
    if (spread > 12.00 && EXECUTOR_CONTRACT !== "0x0000000000000000000000000000000000000000") {
      console.log([ALERT] Profitable spread detected (\server/scanner/index.ts{spread.toFixed(2)}). Simulating execution via contract...);
      
      const executor = new ethers.Contract(EXECUTOR_CONTRACT, EXECUTOR_ABI, wallet);
      const borrowAmount = ethers.parseUnits("1.0", 18); // 1 WETH flash loan
      const routerA = uniPrice < camelotPrice ? UNISWAP_V3_FACTORY : CAMELOT_V3_FACTORY;
      const routerB = uniPrice < camelotPrice ? CAMELOT_V3_FACTORY : UNISWAP_V3_FACTORY;

      // Dry-run simulation to prevent failed reverts/wasted gas
      await executor.executeArbitrage.staticCall(WETH, borrowAmount, routerA, routerB, "0x");
      console.log("[Simulation Passed] Broadcasting arbitrage transaction to Arbitrum One...");

      const tx = await executor.executeArbitrage(WETH, borrowAmount, routerA, routerB, "0x", {
        gasLimit: 800000n
      });
      console.log([Transaction Sent] Hash: );
      const receipt = await tx.wait();
      console.log([Success] Arbitrage executed in block !);
    } else {
      console.log("[ExecutionBridge] Spread below profitability threshold or contract unconfigured. Standing by.");
    }

  } catch (err: any) {
    console.error("[ExecutionBridge Error]:", err.message);
  }
}
