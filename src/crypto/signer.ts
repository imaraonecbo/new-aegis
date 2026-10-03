import { Wallet, verifyTypedData } from "ethers";
import { env } from "../config/env.js";

export const domain = {
  name: "AegisEngine",
  version: "1",
  chainId: 42161,
  verifyingContract: env.EXECUTOR_ADDRESS
} as const;

export const types: Record<string, { name: string; type: string }[]> = {
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
    { name: "routeHash", type: "bytes32" }
  ]
};

export type ExecutionIntent = {
  asset: string;
  amount: bigint;
  minProfit: bigint;
  relayerFeeCap: bigint;
  relayer: string;
  feeRecipient: string;
  nonce: bigint;
  deadline: bigint;
  targetBlock: bigint;
  routeHash: string;
};

export function recoverExecutionSigner(i: ExecutionIntent, s: string) {
  return verifyTypedData(domain, types, i, s);
}

export function assertExecutionSigner(i: ExecutionIntent, s: string, e: string) {
  if (recoverExecutionSigner(i, s).toLowerCase() !== e.toLowerCase()) {
    throw new Error("Invalid execution signature");
  }
}

export const createSigner = () => new Wallet(env.EXECUTION_SIGNER_PRIVATE_KEY);