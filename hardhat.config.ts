import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
const forkRpc=process.env.ARBITRUM_MAINNET_RPC||process.env.ARBITRUM_RPC_URL;
export default defineConfig({
  plugins:[hardhatEthers],
  solidity:{profiles:{
    default:{version:"0.8.24",settings:{optimizer:{enabled:true,runs:200},viaIR:true}},
    production:{version:"0.8.24",settings:{optimizer:{enabled:true,runs:200},viaIR:true}}
  }},
  networks:{
    arbitrumFork:{type:"edr-simulated",chainId:42161,forking:{url:forkRpc||""}},
    arbitrum:{type:"http",chainId:42161,url:forkRpc||"",accounts:process.env.EXECUTOR_PRIVATE_KEY?[process.env.EXECUTOR_PRIVATE_KEY]:[]}
  }
});