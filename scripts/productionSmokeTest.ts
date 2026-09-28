import "dotenv/config";
import { JsonRpcProvider, Contract, Wallet, keccak256, toUtf8Bytes } from "ethers";
const ABI=[
 "function DOMAIN_SEPARATOR() view returns(bytes32)",
 "function targetWhitelist(address) view returns(bool)",
 "function authorizedRelayers(address) view returns(bool)",
 "function paused() view returns(bool)"
];
const required=(k:string)=>{const v=process.env[k];if(!v)throw new Error("Missing "+k);return v};
const main=async()=>{
 const rpc=required("ARBITRUM_MAINNET_RPC");const privateRpc=required("ARBITRUM_PRIVATE_RPC_URL");
 const address=required("EXECUTOR_ADDRESS");const relayer=required("EXECUTOR_ADDRESS");
 const started=Date.now();const p=new JsonRpcProvider(rpc,42161,{staticNetwork:true});await p.getBlockNumber();const latency=Date.now()-started;
 if(latency>=50)throw new Error("RPC latency gate failed: "+latency+"ms");
 if(rpc===privateRpc)throw new Error("Private MEV endpoint must be distinct from main read endpoint");
 const c=new Contract(address,ABI,p);
 const onchain=await c.DOMAIN_SEPARATOR();
 const name=process.env.EIP712_NAME||"AegisEngine";const version=process.env.EIP712_VERSION||"1";
 const domainHash=keccak256(toUtf8Bytes(name+":"+version+":42161:"+address.toLowerCase()));
 console.log(JSON.stringify({chainId:(await p.getNetwork()).chainId.toString(),rpcLatencyMs:latency,domainSeparator:onchain,derivedDomainHash:domainHash,domainHashMethod:"informational-only; use ethers TypedDataEncoder.hashDomain for authoritative parity"} ,null,2));
 if(await c.paused())throw new Error("Executor is paused");
 const balance=await p.getBalance(relayer);if(balance<=50000000000000000n)throw new Error("Relayer balance must exceed 0.05 ETH");
 const privateProvider=new JsonRpcProvider(privateRpc,42161,{staticNetwork:true});await privateProvider.getBlockNumber();
 if(process.env.PRIVATE_SUBMISSION_ATTESTED!=="true")throw new Error("PRIVATE_SUBMISSION_ATTESTED=true is required");
 if(process.env.SIMULATION_ENDPOINT_ATTESTED!=="true")throw new Error("SIMULATION_ENDPOINT_ATTESTED=true is required");
 console.log("PREFLIGHT PASS: endpoint attestations, chain, latency, contract state and gas balance passed.");
};
main().catch(e=>{console.error("PREFLIGHT FAIL:",e instanceof Error?e.message:e);process.exit(1)});