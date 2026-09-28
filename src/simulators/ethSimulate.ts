import {JsonRpcProvider} from "ethers";import {env} from "../config/env";
const p=new JsonRpcProvider(env.ARBITRUM_SIMULATION_RPC_URL,42161,{staticNetwork:true});
export type SimulationRequest={from:string;to:string;data:string;value?:string};
export async function simulatePrivate(tx:SimulationRequest){if(env.ARBITRUM_SIMULATION_RPC_URL===env.ARBITRUM_RPC_URL)throw new Error("Dedicated simulation RPC required");return p.send("eth_call",[tx,"latest"]);}