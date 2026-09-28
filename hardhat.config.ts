import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

const rpc = process.env.ARBITRUM_MAINNET_RPC;
const privateKey = process.env.PRIVATE_KEY;
const optimizer = { enabled: true, runs: 200 };
const solidity = { version: "0.8.26", settings: { evmVersion: "cancun" as const, viaIR: true, optimizer } };
const fork = rpc ? { url: rpc } : undefined;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatVerify],
  test: { mocha: { timeout: 180_000 } },
  solidity: {
    profiles: {
      default: solidity,
      production: solidity,
    },
  },
  networks: {
    hardhat: { type: "edr-simulated", chainId: 42161, ...(fork ? { forking: fork } : {}) },
    local: { type: "edr-simulated", chainId: 42161 },
    arbitrumFork: { type: "edr-simulated", chainId: 42161, ...(fork ? { forking: fork } : {}) },
    arbitrum: {
      type: "http",
      chainId: 42161,
      url: rpc || "",
      accounts: privateKey ? [privateKey] : [],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ARBISCAN_API_KEY || "",
    },
  },
});
