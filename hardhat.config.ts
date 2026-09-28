import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

function getAccounts(): string[] {
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
const solidityConfig = {
  version: "0.8.26" as const,
  settings: {
    evmVersion: "cancun" as const,
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
  },
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatVerify],
  test: { mocha: { timeout: 180_000 } },
  solidity: {
    profiles: {
      default: solidityConfig,
      production: solidityConfig,
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 42161,
      ...(rpc ? { forking: { url: rpc } } : {}),
    },
    local: {
      type: "edr-simulated",
      chainId: 42161,
    },
    arbitrumFork: {
      type: "edr-simulated",
      chainId: 42161,
      ...(rpc ? { forking: { url: rpc } } : {}),
    },
    arbitrum: {
      type: "http",
      chainId: 42161,
      url: rpc || "https://arb1.arbitrum.io/rpc",
      accounts: getAccounts(),
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ARBISCAN_API_KEY || "",
    },
  },
});
