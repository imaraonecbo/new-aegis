// @ts-nocheck
import { expect } from "chai";
import { network } from "hardhat";

export const ARBITRUM_ADDRESSES = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC_NATIVE: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  USDC_BRIDGED: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  AAVE_V3_POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
} as const;

// The V2 test uses a live Arbitrum WETH/USDC pair address already exercised by the suite.
const V2_WETH_USDC_PAIR = "0x57b85FEf094e10b5eeCDF350Af688299E9553378";
const UNISWAP_V3_WETH_USDC_FEE = 500;

const { WETH, USDC_NATIVE: USDC, AAVE_V3_POOL: AAVE, BALANCER_VAULT: BALANCER, UNISWAP_V3_FACTORY } = ARBITRUM_ADDRESSES;

const ERC20 = [
  "function balanceOf(address) view returns(uint256)",
  "function transfer(address,uint256) returns(bool)",
];

const V2_PAIR_ABI = [
  "function token0() view returns(address)",
  "function token1() view returns(address)",
  "function swap(uint256,uint256,address,bytes)",
  "function getReserves() view returns(uint112,uint112,uint32)",
];

const V3_FACTORY_ABI = [
  "function getPool(address,address,uint24) view returns(address)",
];

const V3_POOL_ABI = [
  "function token0() view returns(address)",
  "function token1() view returns(address)",
  "function fee() view returns(uint24)",
  "function factory() view returns(address)",
  "function flash(address,uint256,uint256,bytes)",
];

const EXECUTOR_ABI = [
  "function setTarget(address,bool)",
  "function setSelector(address,bytes4,bool)",
  "function setV2Pair(address,bool)",
  "function executeFlashLoan((address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,bytes32),(address,uint256,bytes)[],(address,address,uint256)[],bytes)",
  "function executeBalancerFlashLoan((address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,bytes32),address[],uint256[],(address,uint256,bytes)[],(address,address,uint256)[],bytes)",
  "function executeUniswapV2FlashLoan((address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,bytes32),address,uint256,uint256,(address,uint256,bytes)[],(address,address,uint256)[],bytes)",
  "function executeUniswapV3FlashLoan((address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,bytes32),address,uint256,uint256,(address,uint256,bytes)[],(address,address,uint256)[],bytes)",
  "function AAVE_POOL() view returns(address)",
  "function BALANCER_VAULT() view returns(address)",
];

const TARGET_ABI = [
  "function executeArbitrage(address,uint256,uint256) returns(uint256)",
];

describe("AegisFlashLoanExecutor - real Arbitrum fork", function () {
  async function setup() {
    const { ethers } = await network.connect();
    const [owner] = await ethers.getSigners();

    const networkInfo = await ethers.provider.getNetwork();
    if (networkInfo.chainId !== 42161n) {
      throw new Error(`REAL FORK TEST REQUIRES ARBITRUM ONE (42161), GOT ${networkInfo.chainId}`);
    }

    const latest = await ethers.provider.getBlockNumber();
    if (latest < 1_000_000) {
      throw new Error("REAL FORK TEST IS NOT CONNECTED TO ARBITRUM ONE STATE. Check ARBITRUM_MAINNET_RPC.");
    }

    const executorFactory = await ethers.getContractFactory("AegisFlashLoanExecutor");
    const executor = await executorFactory.deploy(AAVE, BALANCER, owner.address);
    await executor.waitForDeployment();

    const targetFactory = await ethers.getContractFactory("DeterministicArbTarget");
    const target = await targetFactory.deploy();
    await target.waitForDeployment();

    await executor.setTarget(await target.getAddress(), true);
    await executor.setSelector(
      await target.getAddress(),
      target.interface.getFunction("executeArbitrage")!.selector,
      true
    );

    return { ethers, owner, executor, target };
  }

  async function resolveV3Pool(ethers: any) {
    const factory = new ethers.Contract(
      UNISWAP_V3_FACTORY,
      V3_FACTORY_ABI,
      ethers.provider
    );
    const pool = await factory.getPool(WETH, USDC, UNISWAP_V3_WETH_USDC_FEE);
    if (!pool || pool === ethers.ZeroAddress) {
      throw new Error("Canonical Uniswap V3 WETH/native-USDC 0.05% pool was not found on Arbitrum One.");
    }

    const poolContract = new ethers.Contract(pool, V3_POOL_ABI, ethers.provider);
    const [token0, token1, fee, factoryAddress] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.factory(),
    ]);

    const matchesTokens =
      [token0.toLowerCase(), token1.toLowerCase()].sort().join(":") ===
      [WETH.toLowerCase(), USDC.toLowerCase()].sort().join(":");

    if (!matchesTokens || Number(fee) !== UNISWAP_V3_WETH_USDC_FEE || factoryAddress.toLowerCase() !== UNISWAP_V3_FACTORY.toLowerCase()) {
      throw new Error("Resolved Uniswap V3 pool failed canonical WETH/native-USDC/factory validation.");
    }

    return pool;
  }

  async function impersonate(address: string) {
    const { ethers } = await network.connect();
    await ethers.provider.send("hardhat_impersonateAccount", [address]);
    await ethers.provider.send("hardhat_setBalance", [
      address,
      "0x3635C9ADC5DEA00000",
    ]);
    return ethers.getSigner(address);
  }

  async function seed(token: string, amount: bigint, recipient: string) {
    const { ethers } = await network.connect();
    const whale = await impersonate(AAVE);
    const erc20 = new ethers.Contract(token, ERC20, whale);
    await erc20.transfer(recipient, amount);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [AAVE]);
  }

  async function nextExecutionBlock(ethers: any) {
    const current = await ethers.provider.getBlockNumber();
    const targetBlock = BigInt(current + 1);
    return { targetBlock, mine: async () => {
      await ethers.provider.send("evm_mine");
      const actual = await ethers.provider.getBlockNumber();
      if (BigInt(actual) !== targetBlock) {
        throw new Error(`Expected fork block ${targetBlock}, reached ${actual}`);
      }
    }};
  }

  async function signedExecution(
    executor: any,
    owner: any,
    target: string,
    asset: string,
    amount: bigint,
    nonce: bigint,
    targetBlock: bigint,
    minProfit: bigint,
    relayerFeeCap: bigint
  ) {
    const { ethers } = await network.connect();

    const callData = new ethers.Interface(TARGET_ABI).encodeFunctionData(
      "executeArbitrage",
      [asset, amount, 200]
    );

    const calls = [{ target, value: 0n, data: callData }];
    const approvals = [{ token: asset, spender: target, amount }];

    const routeHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "tuple(address target,uint256 value,bytes data)[]",
          "tuple(address token,address spender,uint256 amount)[]",
        ],
        [calls, approvals]
      )
    );

    const execution = {
      asset,
      amount,
      minProfit,
      relayerFeeCap,
      relayer: owner.address,
      feeRecipient: owner.address,
      nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      targetBlock,
      routeHash,
    };

    const domain = {
      name: "AegisEngine",
      version: "1",
      chainId: 42161,
      verifyingContract: await executor.getAddress(),
    };

    const types = {
      Execution: [
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "minProfit", type: "uint256" },
        { name: "relayerFeeCap", type: "uint256" },
        { name: "relayer", type: "address" },
        { name: "feeRecipient", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "targetBlock", type: "uint256" },
        { name: "routeHash", type: "bytes32" },
      ],
    };

    const signature = await owner.signTypedData(domain, types, execution);
    return { execution, calls, approvals, signature };
  }

  it("executes an Aave V3 WETH flash loan against real fork liquidity", async function () {
    const { ethers, owner, executor, target } = await setup();

    const amount = ethers.parseEther("0.01");
    const profit = amount * 200n / 10_000n;
    const feeCap = ethers.parseEther("0.000001");

    await seed(WETH, amount + profit, await target.getAddress());

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, await target.getAddress(), WETH, amount, 1n,
      preparedBlock.targetBlock, 0n, feeCap
    );
    await preparedBlock.mine();

    const before = await new ethers.Contract(WETH, ERC20, owner).balanceOf(owner.address);
    await executor.executeFlashLoan(prepared.execution, prepared.calls, prepared.approvals, prepared.signature);
    const after = await new ethers.Contract(WETH, ERC20, owner).balanceOf(owner.address);
    expect(after).to.be.gt(before);
  });

  it("executes a Balancer USDC flash loan against real fork liquidity", async function () {
    const { ethers, owner, executor, target } = await setup();

    const amount = 100_000n;
    const feeCap = 1n;
    await seed(USDC, amount + 20_000n, await target.getAddress());

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, await target.getAddress(), USDC, amount, 2n,
      preparedBlock.targetBlock, 0n, feeCap
    );
    await preparedBlock.mine();

    await executor.executeBalancerFlashLoan(
      prepared.execution,
      [USDC],
      [amount],
      prepared.calls,
      prepared.approvals,
      prepared.signature
    );
  });

  it("executes a real Uniswap V2 flash swap when the WETH/USDC pair exists", async function () {
    const { ethers, owner, executor, target } = await setup();

    const pair = V2_WETH_USDC_PAIR;
    await executor.setV2Pair(pair, true);

    const pairContract = new ethers.Contract(pair, V2_PAIR_ABI, ethers.provider);
    const [token0, token1, reserves] = await Promise.all([
      pairContract.token0(),
      pairContract.token1(),
      pairContract.getReserves(),
    ]);

    const pairTokens = [token0.toLowerCase(), token1.toLowerCase()];
    if (!pairTokens.includes(WETH.toLowerCase()) || !pairTokens.includes(USDC.toLowerCase())) {
      throw new Error("Configured Arbitrum V2 pair is not a WETH/native-USDC pair.");
    }
    if (reserves[0] === 0n || reserves[1] === 0n) {
      throw new Error("Configured Arbitrum V2 pair has no liquidity.");
    }

    const amount = ethers.parseEther("0.0001");
    const amount0Out = token0.toLowerCase() === WETH.toLowerCase() ? amount : 0n;
    const amount1Out = amount0Out === 0n ? amount : 0n;
    const profit = amount * 200n / 10_000n;

    await seed(WETH, amount + profit, await target.getAddress());

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, await target.getAddress(), WETH, amount, 3n,
      preparedBlock.targetBlock, 0n, 1n
    );
    await preparedBlock.mine();

    await executor.executeUniswapV2FlashLoan(
      prepared.execution, pair, amount0Out, amount1Out,
      prepared.calls, prepared.approvals, prepared.signature
    );
  });

  it("executes a real Uniswap V3 flash loan against the Arbitrum WETH/USDC pool", async function () {
    const { ethers, owner, executor, target } = await setup();
    const pool = await resolveV3Pool(ethers);
    const poolContract = new ethers.Contract(pool, V3_POOL_ABI, ethers.provider);

    const amount = ethers.parseEther("0.001");
    const profit = amount * 200n / 10_000n;
    await seed(WETH, amount + profit, await target.getAddress());

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, await target.getAddress(), WETH, amount, 4n,
      preparedBlock.targetBlock, 0n, 1n
    );
    await preparedBlock.mine();

    const token0 = await poolContract.token0();
    const amount0 = token0.toLowerCase() === WETH.toLowerCase() ? amount : 0n;
    const amount1 = amount0 === 0n ? amount : 0n;

    await executor.executeUniswapV3FlashLoan(
      prepared.execution, pool, amount0, amount1,
      prepared.calls, prepared.approvals, prepared.signature
    );
  });

  it("rejects an unwhitelisted target", async function () {
    const { ethers, owner, executor } = await setup();
    const target = ethers.Wallet.createRandom().address;
    const amount = ethers.parseEther("0.001");

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, target, WETH, amount, 100n,
      preparedBlock.targetBlock, 0n, 0n
    );
    await preparedBlock.mine();

    await expect(
      executor.executeFlashLoan(
        prepared.execution, prepared.calls, prepared.approvals, prepared.signature
      )
    ).to.revert(ethers);
  });

  it("rejects an invalid EIP-712 signature", async function () {
    const { ethers, owner, executor, target } = await setup();
    const amount = ethers.parseEther("0.001");

    const preparedBlock = await nextExecutionBlock(ethers);
    const prepared = await signedExecution(
      executor, owner, await target.getAddress(), WETH, amount, 101n,
      preparedBlock.targetBlock, 0n, 0n
    );
    await preparedBlock.mine();

    const attacker = ethers.Wallet.createRandom();
    const badSignature = await attacker.signTypedData(
      {
        name: "AegisEngine",
        version: "1",
        chainId: 42161,
        verifyingContract: await executor.getAddress(),
      },
      {
        Execution: [
          { name: "asset", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "minProfit", type: "uint256" },
          { name: "relayerFeeCap", type: "uint256" },
          { name: "relayer", type: "address" },
          { name: "feeRecipient", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "targetBlock", type: "uint256" },
          { name: "routeHash", type: "bytes32" },
        ],
      },
      prepared.execution
    );

    await expect(
      executor.executeFlashLoan(
        prepared.execution, prepared.calls, prepared.approvals, badSignature
      )
    ).to.revert(ethers);
  });
});
