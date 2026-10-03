import "dotenv/config";
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { readFile, writeFile } from "node:fs/promises";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
};

const key = required("AA_OWNER_PRIVATE_KEY");
const apiKey = required("ALCHEMY_API_KEY");
const executor = required("EXECUTOR_ADDRESS");
const deployRpc = required("ARBITRUM_DEPLOY_RPC");
const autoAuthorize = process.env.AA_AUTO_AUTHORIZE === "true";
const persist = process.env.AA_PERSIST_ENV !== "false";

if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("AA_OWNER_PRIVATE_KEY must be a 32-byte hex key");
if (!/^0x[0-9a-fA-F]{40}$/.test(executor)) throw new Error("EXECUTOR_ADDRESS is invalid");

const signer = privateKeyToAccount(key as `0x${string}`);
const client = createSmartWalletClient({
  transport: alchemyWalletTransport({ apiKey }),
  chain: arbitrum,
  signer
});

const { address: aaAddress } = await client.requestAccount({
  creationHint: { accountType: "sma-b", createAdditional: true }
});

const provider = new JsonRpcProvider(deployRpc, 42161, { staticNetwork: true });
const net = await provider.getNetwork();
if (net.chainId !== 42161n) throw new Error(`Wrong deployment chain: ${net.chainId}`);

const abi = [
  "function owner() view returns(address)",
  "function authorizedRelayers(address) view returns(bool)",
  "function setRelayer(address,bool)"
] as const;

const executorContract = new Contract(executor, abi, provider);
const owner = (await executorContract.owner()).toLowerCase();
const deployer = new Wallet(key, provider);

if (deployer.address.toLowerCase() !== owner) {
  throw new Error(`AA owner key ${deployer.address} does not own executor ${executor}`);
}

let authorized = await executorContract.authorizedRelayers(aaAddress);
let txHash: string | null = null;

if (!authorized && autoAuthorize) {
  const tx = await (executorContract.connect(deployer) as any).setRelayer(aaAddress, true);
  txHash = tx.hash;
  await tx.wait(5);
  authorized = await executorContract.authorizedRelayers(aaAddress);
}

if (!authorized) {
  throw new Error("AA smart account is not authorized. Set AA_AUTO_AUTHORIZE=true for one-time owner authorization.");
}

if (persist) {
  const path = ".env";
  const current = await readFile(path, "utf8");
  const line = `AA_ACCOUNT_ADDRESS=${aaAddress}`;
  const re = /^AA_ACCOUNT_ADDRESS=.*$/m;
  const updated = re.test(current) ? current.replace(re, line) : current.trimEnd() + `\n${line}\n`;
  await writeFile(path, updated, "utf8");
}

console.log(JSON.stringify({
  chainId: 42161,
  executor,
  owner: deployer.address,
  aaAccount: aaAddress,
  authorizedRelayer: authorized,
  ownerAuthorizationTx: txHash
}, null, 2));