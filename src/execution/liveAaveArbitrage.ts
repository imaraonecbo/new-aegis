import { Contract, JsonRpcProvider, AbiCoder, keccak256, Wallet } from "ethers";
import { env } from "../config/env.js";
import { executeFiveGates, FiveGateOpportunity } from "../engine/runner.js";
import { types, domain } from "../crypto/signer.js";
import { TOKENS } from "../../server/chain/constants.js";
import { getUniswapV3Quotes } from "../../server/scanner/uniswapV3.js";

const SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const AAVE_ABI = ["function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)"];
const EXECUTOR_ABI = [
  "function executeFlashLoan((address asset,uint256 amount,uint256 minProfit,uint256 relayerFeeCap,address relayer,address feeRecipient,uint256 nonce,uint256 deadline,uint256 targetBlock,bytes32 routeHash) e,(address target,uint256 value,bytes data)[] c,(address token,address spender,uint256 amount)[] a,bytes sig)",
  "function targetWhitelist(address) view returns (bool)",
  "function selectorWhitelist(address,bytes4) view returns (bool)",
  "function treasury() view returns (address)",
  "function paused() view returns (bool)"
] as const;
const SWAP_ABI = [
  "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"
] as const;

type Call={target:string;value:bigint;data:string};
type Approval={token:string;spender:string;amount:bigint};
const coder=AbiCoder.defaultAbiCoder();
const provider=new JsonRpcProvider(env.ARBITRUM_RPC_URL,42161,{staticNetwork:true});

function bpsDown(v:bigint,bps:number){return v*(10000n-BigInt(bps))/10000n;}
function selector(data:string){return data.slice(0,10).toLowerCase();}

async function assertRouteAllowed(executor:Contract,calls:Call[]){
  if(await executor.paused()) throw new Error("LIVE_EXECUTOR_PAUSED");
  for(const c of calls){
    if(!(await executor.targetWhitelist(c.target))) throw new Error("TARGET_NOT_WHITELISTED:"+c.target);
    if(!(await executor.selectorWhitelist(c.target,selector(c.data)))) throw new Error("SELECTOR_NOT_WHITELISTED:"+selector(c.data));
  }
}

export async function buildAndExecuteWethArb(testSizeWeth:number){
  if(!env.ENGINE_ENABLED||env.ENGINE_DRY_RUN) throw new Error("LIVE_ENGINE_NOT_ARMED");
  if(!env.EXECUTOR_PRIVATE_KEY) throw new Error("EXECUTOR_PRIVATE_KEY_REQUIRED");

  const executor=new Contract(env.EXECUTOR_ADDRESS,EXECUTOR_ABI,provider);
  const relayer=new Wallet(env.EXECUTOR_PRIVATE_KEY,provider);
  const signer=new Wallet(env.EXECUTION_SIGNER_PRIVATE_KEY,provider);
  const weth=TOKENS.WETH;
  const usdc=TOKENS.USDC;
  const amount=BigInt(Math.floor(testSizeWeth*10**weth.decimals));
  if(amount<=0n) throw new Error("INVALID_FLASH_AMOUNT");

  const forward=await getUniswapV3Quotes(weth.address,usdc.address,amount);
  const usable=forward.filter(q=>!q.error&&q.amountOut>0n);
  if(usable.length<2) throw new Error("INSUFFICIENT_UNISWAP_V3_ROUTES");

  let best:{sellFee:number;buyFee:number;usdcOut:bigint;wethBack:bigint}|undefined;
  for(const sell of usable){
    const reverse=await getUniswapV3Quotes(usdc.address,weth.address,sell.amountOut);
    for(const buy of reverse){
      if(buy.error||buy.amountOut<=0n) continue;
      if(!best||buy.amountOut>best.wethBack) best={sellFee:sell.feeTier,buyFee:buy.feeTier,usdcOut:sell.amountOut,wethBack:buy.amountOut};
    }
  }
  if(!best) throw new Error("NO_ROUND_TRIP_ROUTE");

  const aavePool=new Contract("0x794a61358D6845594F94dc1DB02A252b5b4814aD",AAVE_ABI,provider);
  const premiumBps=Number(await aavePool.FLASHLOAN_PREMIUM_TOTAL());
  const flashLoanFee=amount*BigInt(premiumBps)/10000n;
  const currentBlock=await provider.getBlockNumber();
  const targetBlock=currentBlock+env.TARGET_BLOCK_OFFSET;
  const deadline=BigInt(Math.floor(Date.now()/1000)+20);
  const feeData=await provider.getFeeData();
  const relayerFeeCap=BigInt(Math.ceil(Number(amount)*env.RELAYER_FEE_CAP_BPS/10000));
  const nonce=BigInt(Date.now())*1000n;
  const ethUsd=Number(best.usdcOut)/1e6/testSizeWeth;
  const requiredProfit=BigInt(Math.ceil(Math.max(env.MIN_PROFIT_USD,1)/Math.max(ethUsd,1)*1e18));
  const minProfit=requiredProfit+flashLoanFee;
  const desiredUsdc=bpsDown(best.usdcOut,env.MAX_SLIPPAGE_BPS);

  const swapInterface=new Contract(SWAP_ROUTER_02,SWAP_ABI).interface;
  const firstData=swapInterface.encodeFunctionData("exactOutputSingle",[{
    tokenIn:weth.address,tokenOut:usdc.address,fee:best.sellFee,recipient:env.EXECUTOR_ADDRESS,
    deadline:Number(deadline),amountOut:desiredUsdc,amountInMaximum:amount,sqrtPriceLimitX96:0
  }]);
  const secondData=swapInterface.encodeFunctionData("exactInputSingle",[{
    tokenIn:usdc.address,tokenOut:weth.address,fee:best.buyFee,recipient:env.EXECUTOR_ADDRESS,
    deadline:Number(deadline),amountIn:desiredUsdc,amountOutMinimum:bpsDown(best.wethBack,env.MAX_SLIPPAGE_BPS),sqrtPriceLimitX96:0
  }]);

  const calls:Call[]=[
    {target:SWAP_ROUTER_02,value:0n,data:firstData},
    {target:SWAP_ROUTER_02,value:0n,data:secondData}
  ];
  const approvals:Approval[]=[
    {token:weth.address,spender:SWAP_ROUTER_02,amount:amount},
    {token:usdc.address,spender:SWAP_ROUTER_02,amount:desiredUsdc}
  ];
  await assertRouteAllowed(executor,calls);

  const routeHash=keccak256(coder.encode(
    ["tuple(address target,uint256 value,bytes data)[]","tuple(address token,address spender,uint256 amount)[]"],
    [calls,approvals]
  ));

  const baseIntent={
    asset:weth.address,amount,minProfit,relayer:relayer.address,feeRecipient:relayer.address,
    relayerFeeCap,nonce,deadline,targetBlock,routeHash
  };
  const signature=await signer.signTypedData(domain,types,baseIntent);
  const iface=new Contract(env.EXECUTOR_ADDRESS,EXECUTOR_ABI).interface;
  const data=iface.encodeFunctionData("executeFlashLoan",[baseIntent,calls,approvals,signature]);

  // The executor requires targetBlock == block.number. Simulate an identical route
  // at the current block, then sign the actual transaction for the next block.
  const simIntent={...baseIntent,targetBlock:BigInt(currentBlock)};
  const simSignature=await signer.signTypedData(domain,types,simIntent);
  const simulationData=iface.encodeFunctionData("executeFlashLoan",[simIntent,calls,approvals,simSignature]);

  const tx=await relayer.populateTransaction({
    to:env.EXECUTOR_ADDRESS,data,value:0n,chainId:42161,
    nonce:await provider.getTransactionCount(relayer.address,"pending"),
    maxFeePerGas:feeData.maxFeePerGas??feeData.gasPrice??0n,
    maxPriorityFeePerGas:feeData.maxPriorityFeePerGas??0n
  });
  const rawTransaction=await relayer.signTransaction(tx);

  const grossProfitUsd=Math.max(0,(Number(best.wethBack)-Number(amount))/1e18*ethUsd);
  const risk={
    quoteTimestampMs:Date.now(),quoteBlock:currentBlock,currentBlock,targetBlock,
    expectedGrossProfitUsd:grossProfitUsd,principalUsd:testSizeWeth*ethUsd,
    dexFeesUsd:0,flashLoanFeeUsd:Number(flashLoanFee)/1e18*ethUsd,gasCostUsd:0,gasReserveUsd:0,aaFeeUsd:0,
    slippageBps:env.MAX_SLIPPAGE_BPS,priceImpactBps:0,priceMoveBps:0,
    expectedOutputUsd:Number(best.wethBack)/1e18*ethUsd
  };

  const opportunity:FiveGateOpportunity={
    from:relayer.address,to:env.EXECUTOR_ADDRESS,calldata:data,rawTransaction,
    targetBlock,netProfitUsd:grossProfitUsd,minProfitUsd:env.MIN_PROFIT_USD,
    intent:baseIntent,signature,expectedSigner:signer.address,risk,simulationData
  };
  const result=await executeFiveGates(opportunity);
  return {
    result,
    route:{sellFee:best.sellFee,buyFee:best.buyFee,quotedWethBack:best.wethBack.toString(),borrowAmount:amount.toString()},
    treasury:await executor.treasury()
  };
}
