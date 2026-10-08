// @ts-nocheck
import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

function getAccounts() {
  const raw = process.env.PRIVATE_KEY?.trim();
  if (!raw) return [];
  const key = raw.replace(/^0x/i, "");
  if (!/^[a-fA-F0-9]{64}$/.test(key)) {
    console.warn("Warning: PRIVATE_KEY format is invalid; no Arbitrum deployer account will be configured.");
    return [];
  }
  return [`0x${key}`];
}

const rpc = process.env.ARBITRUM_MAINNET_RPC?.trim();
const sepoliaRpc = process.env.ARBITRUM_SEPOLIA_RPC?.trim() || "https://sepolia-rollup.arbitrum.io/rpc";
const forkRpc = rpc || "https://arb1.arbitrum.io/rpc";

const solidityConfig = {
  version: "0.8.26",
  settings: {
    evmVersion: "cancun",
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
  },
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatVerify],
  test: { mocha: { timeout: 180_000 } },
  solidity: { profiles: { default: solidityConfig, production: solidityConfig } },
  networks: {
    // The default test network is intentionally forked from Arbitrum One.
    // This prevents the real-fork suite from silently running on an empty EDR chain
    // with chainId 42161 but no Arbitrum state.
    hardhat: {
      type: "edr-simulated",
      chainId: 42161,
      forking: { url: forkRpc },
    },
    local: {
      type: "edr-simulated",
      chainId: 42161,
    },
    arbitrumFork: {
      type: "edr-simulated",
      chainId: 42161,
      forking: { url: forkRpc },
    },
    arbitrum: {
      type: "http", chainId: 42161, url: forkRpc, accounts: getAccounts(),
    },
    arbitrumSepolia: {
      type: "http", chainId: 421614, url: sepoliaRpc, accounts: getAccounts(),
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ARBISCAN_API_KEY || "",
    },
  },
});
