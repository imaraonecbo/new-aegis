import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

const forkRpc = process.env.ARBITRUM_MAINNET_RPC || "https://arb1.arbitrum.io/rpc";

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.26",
        settings: {
          evmVersion: "cancun",
          viaIR: true,
          optimizer: { enabled: true, runs: 1_000_000 },
        },
      },
      production: {
        version: "0.8.26",
        settings: {
          evmVersion: "cancun",
          viaIR: true,
          optimizer: { enabled: true, runs: 1_000_000 },
        },
      },
    },
  },
  networks: {
    local: { type: "edr-simulated", chainId: 42161 },
    arbitrumFork: {
      type: "edr-simulated",
      chainId: 42161,
      forking: { url: forkRpc },
    },
    arbitrum: {
      type: "http",
      chainId: 42161,
      url: forkRpc,
      accounts: process.env.EXECUTOR_PRIVATE_KEY ? [process.env.EXECUTOR_PRIVATE_KEY] : [],
    },
  },
});