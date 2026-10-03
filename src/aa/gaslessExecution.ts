import "dotenv/config";
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import type { Address, Hex } from "viem";
import { Contract, JsonRpcProvider } from "ethers";
import { env } from "../config/env";
import { simulatePrivate } from "../simulators/ethSimulate";
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
  try { await readFile(panicFile); return true; }
  catch { return false; }
}

function hexData(value: string): Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error("AA: calldata is not valid hex");
  return value as Hex;
}

let cachedAccount: Address | undefined;

export async function getGaslessAccount(): Promise<Address> {
  if (cachedAccount) return cachedAccount;

  const key = env.AA_OWNER_PRIVATE_KEY;
  const signer = privateKeyToAccount(key as `0x${string}`);
  const client = createSmartWalletClient({
    transport: alchemyWalletTransport({ apiKey: env.ALCHEMY_API_KEY }),
    chain: arbitrum,
    signer,
  });

  const requested = env.AA_ACCOUNT_ADDRESS
    ? requireAddress(env.AA_ACCOUNT_ADDRESS, "AA_ACCOUNT_ADDRESS")
    : (await client.requestAccount({
        creationHint: { accountType: "sma-b", createAdditional: true }
      })).address as Address;

  cachedAccount = requested;
  return requested;
}

export async function executeGaslessCall(input: {
  to: string;
  data: string;
  netProfitUsd: number;
}): Promise<{ callId: string; account: string; maxGasToken: bigint }> {
  if (!env.AA_ENABLED) throw new Error("AA: gasless execution is disabled");
  if (await panicActive()) throw new Error("AA: global panic switch is active");
  if (input.netProfitUsd < env.MIN_PROFIT_USD) throw new Error("AA: profitability gate failed");

  const executor = requireAddress(env.EXECUTOR_ADDRESS, "EXECUTOR_ADDRESS");
  const target = requireAddress(input.to, "execution target");
  const data = hexData(input.data);
  if (target.toLowerCase() !== executor.toLowerCase()) {
    throw new Error("AA: execution target is not the configured executor");
  }

  const account = await getGaslessAccount();\n  if (input.expectedRelayer.toLowerCase() !== account.toLowerCase()) {\n    throw new Error(`AA: EIP-712 relayer ${input.expectedRelayer} does not match smart account ${account}`);\n  }

  const readProvider = new JsonRpcProvider(env.ARBITRUM_RPC_URL, 42161, { staticNetwork: true });
  const network = await readProvider.getNetwork();
  if (network.chainId !== 42161n) throw new Error(`AA: wrong chain ${network.chainId}`);

  const executorContract = new Contract(executor, EXECUTOR_ABI, readProvider);
  if (await executorContract.paused()) throw new Error("AA: executor is paused");
  if (!(await executorContract.authorizedRelayers(account))) {
    throw new Error("AA: smart account is not an authorized executor relayer");
  }

  await simulatePrivate({
    from: account,
    to: executor,
    data
  });

  if (await panicActive()) throw new Error("AA: panic switch activated during preparation");

  const client = createSmartWalletClient({
    transport: alchemyWalletTransport({ apiKey: env.ALCHEMY_API_KEY }),
    chain: arbitrum,
    signer: privateKeyToAccount(env.AA_OWNER_PRIVATE_KEY as `0x${string}`)
  });

  const prepared = await client.prepareCalls({
    account,
    calls: [{ to: executor, value: 0n, data }],
    capabilities: {
      paymaster: {
        policyId: env.ALCHEMY_POLICY_ID,
        erc20: {
          tokenAddress: requireAddress(env.AA_GAS_TOKEN_ADDRESS, "AA_GAS_TOKEN_ADDRESS"),
          maxTokenAmount: env.AA_MAX_GAS_TOKEN_AMOUNT,
          postOpSettings: { autoApprove: true }
        }
      }
    }
  });

  if (prepared.type === "paymaster-permit") {
    throw new Error("AA: paymaster requested an interactive permit; refusing headless execution");
  }

  const feePayment = prepared.feePayment;
  if (!feePayment || feePayment.sponsored) {
    if (!feePayment) throw new Error("AA: paymaster returned no fee quote");
  }

  const maxGasToken = feePayment.maxAmount;
  if (feePayment.tokenAddress.toLowerCase() !== env.AA_GAS_TOKEN_ADDRESS.toLowerCase()) {
    throw new Error("AA: paymaster returned an unexpected gas token");
  }
  if (maxGasToken > env.AA_MAX_GAS_TOKEN_AMOUNT) {
    throw new Error(`AA: gas-token quote exceeds cap: ${maxGasToken} > ${env.AA_MAX_GAS_TOKEN_AMOUNT}`);
  }

  if (await panicActive()) throw new Error("AA: panic switch activated before signing");

  const signed = await client.signPreparedCalls(prepared);
  if (await panicActive()) throw new Error("AA: panic switch activated before broadcast");

  const sent = await client.sendPreparedCalls(signed);
  const callId = sent.id;
  if (!callId) throw new Error("AA: Wallet API returned no call ID");

  console.log(JSON.stringify({
    mode: "ERC-4337-AA",
    account,
    executor,
    callId,
    gasToken: feePayment.tokenAddress,
    maxGasToken: maxGasToken.toString()
  }));

  return { callId, account, maxGasToken };
}
