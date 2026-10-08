import "dotenv/config";
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import type { Address, Hex } from "viem";
import { Contract, JsonRpcProvider } from "ethers";
import { env } from "../config/env.js";
import { simulatePrivate } from "../simulators/ethSimulate.js";
import { readFile } from "node:fs/promises";

const EXECUTOR_ABI = [
  "function paused() view returns (bool)",
  "function authorizedRelayers(address) view returns (bool)"
] as const;
const panicFile = process.env.AEGIS_PANIC_FILE?.trim() || "runtime/aegis.panic";

function requireAddress(value: string, name: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`AA: invalid ${name}`);
  return value as Address;
}
async function panicActive(): Promise<boolean> {
  if (process.env.AEGIS_PANIC === "true") return true;
  try { await readFile(panicFile); return true; } catch { return false; }
}
function hexData(value: string): Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error("AA: calldata is not valid hex");
  return value as Hex;
}
let cachedAccount: Address | undefined;
const aaChain = env.CHAIN_ID === 421614 ? arbitrumSepolia : arbitrum;

export async function getGaslessAccount(): Promise<Address> {
  if (cachedAccount) return cachedAccount;
  const signer = privateKeyToAccount(env.AA_OWNER_PRIVATE_KEY as `0x${string}`);
  const client = createSmartWalletClient({ transport: alchemyWalletTransport({ apiKey: env.ALCHEMY_API_KEY! }), chain: aaChain, signer, paymaster: { policyId: env.ALCHEMY_POLICY_ID! } });
  const requested = env.AA_ACCOUNT_ADDRESS
    ? requireAddress(env.AA_ACCOUNT_ADDRESS, "AA_ACCOUNT_ADDRESS")
    : (await client.requestAccount({ creationHint: { accountType: "sma-b", createAdditional: true } })).address as Address;
  cachedAccount = requested;
  return requested;
}

export type GaslessExecutionResult = {
  callId: string;
  account: string;
  maxSponsoredGasWei: bigint;
  status: "success";
  transactionHash?: string;
  receipts: unknown[];
};

function estimatePreparedGasWei(prepared: any): bigint {
  const candidate = Array.isArray(prepared?.data)
    ? prepared.data.find((x: any) => x?.type === "user-operation-v070" || x?.type === "user-operation-v060")
    : prepared;
  const d = candidate?.data ?? candidate;
  const gasFields = ["callGasLimit", "verificationGasLimit", "preVerificationGas", "paymasterVerificationGasLimit", "paymasterPostOpGasLimit"];
  const gas = gasFields.reduce((sum, k) => sum + (d?.[k] !== undefined ? BigInt(d[k]) : 0n), 0n);
  const fee = d?.maxFeePerGas !== undefined ? BigInt(d.maxFeePerGas) : 0n;
  if (gas === 0n || fee === 0n) throw new Error("AA: sponsored UserOperation did not expose usable gas/fee fields");
  return gas * fee;
}

export async function executeGaslessCall(input: {
  to: string; data: string; netProfitUsd: number; expectedRelayer: string;
}): Promise<GaslessExecutionResult> {
  if (!env.AA_ENABLED) throw new Error("AA: gasless execution is disabled");
  if (await panicActive()) throw new Error("AA: global panic switch is active");
  if (input.netProfitUsd < env.MIN_PROFIT_USD) throw new Error("AA: profitability gate failed");

  const executor = requireAddress(env.EXECUTOR_ADDRESS, "EXECUTOR_ADDRESS");
  const chain = aaChain;
  const data = hexData(input.data);
  if (input.to.toLowerCase() !== executor.toLowerCase()) throw new Error("AA: execution target must be the configured executor");

  const account = await getGaslessAccount();
  if (input.expectedRelayer.toLowerCase() !== account.toLowerCase()) throw new Error(`AA: EIP-712 relayer ${input.expectedRelayer} does not match smart account ${account}`);

  const rpc = env.CHAIN_ID === 421614 ? (env.ARBITRUM_SEPOLIA_RPC_URL || env.ARBITRUM_RPC_URL) : env.ARBITRUM_RPC_URL;
  const provider = new JsonRpcProvider(rpc, env.CHAIN_ID, { staticNetwork: true });
  if ((await provider.getNetwork()).chainId !== BigInt(env.CHAIN_ID)) throw new Error("AA: wrong chain");

  const executorContract = new Contract(executor, EXECUTOR_ABI, provider);
  if (await executorContract.paused()) throw new Error("AA: executor is paused");
  if (!(await executorContract.authorizedRelayers(account))) throw new Error("AA: smart account is not an authorized executor relayer");

  await simulatePrivate({ from: account, to: executor, data });
  if (await panicActive()) throw new Error("AA: panic switch activated during preparation");

  const signer = privateKeyToAccount(env.AA_OWNER_PRIVATE_KEY as `0x${string}`);
  const client = createSmartWalletClient({
    transport: alchemyWalletTransport({ apiKey: env.ALCHEMY_API_KEY! }),
    chain,
    signer,
    paymaster: { policyId: env.ALCHEMY_POLICY_ID! }
  });

  const prepared: any = await client.prepareCalls({
    account,
    calls: [{ to: executor, value: 0n, data }]
  });

  if (prepared.type === "paymaster-permit") throw new Error("AA: interactive paymaster permit requested; refusing headless execution");

  const estimatedSponsoredGasWei = estimatePreparedGasWei(prepared);
  if (estimatedSponsoredGasWei > env.AA_MAX_SPONSORED_GAS_WEI) {
    throw new Error(`AA: sponsored gas estimate exceeds local cap: ${estimatedSponsoredGasWei} > ${env.AA_MAX_SPONSORED_GAS_WEI}`);
  }

  if (await panicActive()) throw new Error("AA: panic switch activated before signing");
  const signed = await client.signPreparedCalls(prepared);
  if (await panicActive()) throw new Error("AA: panic switch activated before broadcast");

  const sent = await client.sendPreparedCalls({ signedCalls: signed });
  const callId = sent.id;
  if (!callId) throw new Error("AA: Wallet API returned no call ID");

  const status: any = await client.waitForCallsStatus({ id: callId });
  if (status?.status !== "success") throw new Error(`AA: sponsored call did not succeed: ${String(status?.status ?? "unknown")}`);

  const receipts = Array.isArray(status?.receipts) ? status.receipts : [];
  const transactionHash = status?.transactionHash ?? status?.receipts?.[0]?.transactionHash ?? status?.receipts?.[0]?.receipt?.transactionHash;

  console.log(JSON.stringify({
    mode: "ERC-4337-BSO",
    chainId: env.CHAIN_ID,
    account,
    executor,
    callId,
    status: status.status,
    transactionHash,
    estimatedSponsoredGasWei: estimatedSponsoredGasWei.toString()
  }));
  return { callId, account, maxSponsoredGasWei: estimatedSponsoredGasWei, status: "success", transactionHash, receipts };
}
