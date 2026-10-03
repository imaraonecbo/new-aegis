import "dotenv/config";
import { JsonRpcProvider, Contract, TypedDataEncoder } from "ethers";
const ABI=["function DOMAIN_SEPARATOR() view returns(bytes32)","function targetWhitelist(address) view returns(bool)","function authorizedRelayers(address) view returns(bool)","function paused() view returns(bool)"];\nconst ERC20_ABI=["function balanceOf(address) view returns(uint256)"];
const required=(k:string)=>{const v=process.env[k];if(!v)throw new Error("Missing "+k);return v};
const main=async()=>{
 const rpc=process.env.ARBITRUM_MAINNET_RPC||process.env.ARBITRUM_RPC_URL||required("ARBITRUM_MAINNET_RPC");const privateRpc=required("ARBITRUM_PRIVATE_RPC_URL");const address=required("EXECUTOR_ADDRESS");const aa=process.env.AA_ENABLED==="true";const relayer=aa?(process.env.AA_ACCOUNT_ADDRESS||required("AA_ACCOUNT_ADDRESS")):required("RELAYER_ADDRESS");
 const p=new JsonRpcProvider(rpc,42161,{staticNetwork:true});const t=Date.now();await p.getBlockNumber();const latency=Date.now()-t;
 if(latency>=50)throw new Error("Read RPC latency gate failed: "+latency+"ms");
 if(rpc===privateRpc)throw new Error("Private MEV RPC must not equal public/read RPC");
 const c=new Contract(address,ABI,p);const onchain=await c.DOMAIN_SEPARATOR();
 const offchain=TypedDataEncoder.hashDomain({name:"AegisEngine",version:"1",chainId:42161,verifyingContract:address});
 if(onchain.toLowerCase()!==offchain.toLowerCase())throw new Error("EIP-712 DOMAIN_SEPARATOR mismatch");
 if(await c.paused())throw new Error("Executor is paused");
 const balance=await p.getBalance(relayer);\n if(!aa&&balance<=50000000000000000n)throw new Error("Relayer balance must exceed 0.05 ETH");\n if(aa){const gasToken=required("AA_GAS_TOKEN_ADDRESS");const token=new Contract(gasToken,ERC20_ABI,p);const tokenBalance=await token.balanceOf(relayer);if(tokenBalance<=0n)throw new Error("AA smart account has no ERC-20 gas token balance");if(!(await c.authorizedRelayers(relayer)))throw new Error("AA smart account is not an authorized executor relayer");}
 const privateProvider=new JsonRpcProvider(privateRpc,42161,{staticNetwork:true});await privateProvider.getBlockNumber();
 if(process.env.PRIVATE_SUBMISSION_ATTESTED!=="true")throw new Error("PRIVATE_SUBMISSION_ATTESTED=true required");
 if(process.env.SIMULATION_ENDPOINT_ATTESTED!=="true")throw new Error("SIMULATION_ENDPOINT_ATTESTED=true required");
 const routers=Object.entries({UNISWAP_V3_ROUTER:process.env.UNISWAP_V3_ROUTER,CAMELOT_ROUTER:process.env.CAMELOT_ROUTER,CURVE_ROUTER:process.env.CURVE_ROUTER,BALANCER_VAULT:process.env.BALANCER_VAULT});
 const whitelist=Object.fromEntries(await Promise.all(routers.filter(([,a])=>a).map(async([n,a])=>[n,await c.targetWhitelist(a!)])));
 if(Object.values(whitelist).some(v=>!v))throw new Error("One or more configured DEX targets are not whitelisted: "+JSON.stringify(whitelist));
 console.log(JSON.stringify({chainId:(await p.getNetwork()).chainId.toString(),rpcLatencyMs:latency,domainSeparator:onchain,executionMode:aa?"ERC-4337-AA":"EOA-private",relayer,relayerBalanceEth:Number(balance)/1e18,whitelist},null,2));
 console.log("PREFLIGHT PASS");
};
main().catch(e=>{console.error("PREFLIGHT FAIL:",e instanceof Error?e.message:e);process.exit(1)});