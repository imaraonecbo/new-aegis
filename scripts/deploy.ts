// @ts-nocheck
import "dotenv/config";
import { network } from "hardhat";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isAddress, getAddress, parseEther } from "ethers";

const required = (name: string): string => { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; };
const address = (name: string): string => { const value = required(name); if (!isAddress(value)) throw new Error(`Invalid Ethereum address in ${name}: ${value}`); return getAddress(value); };
const optionalAddress = (name: string): string | undefined => { const value = process.env[name]?.trim(); if (!value) return undefined; if (!isAddress(value)) throw new Error(`Invalid Ethereum address in ${name}: ${value}`); return getAddress(value); };
const optionalSelector = (name: string): string | undefined => { const value = process.env[name]?.trim(); if (!value) return undefined; if (!/^0x[0-9a-fA-F]{8}$/.test(value)) throw new Error(`Invalid 4-byte selector in ${name}: ${value}`); return value; };

const artifactPath = resolve("artifacts/contracts/AegisFlashLoanExecutor.sol/AegisFlashLoanExecutor.json");
const chainId = Number(process.env.DEPLOY_CHAIN_ID || process.env.CHAIN_ID || 421614);
const deploymentPath = resolve(process.env.DEPLOYMENT_FILE || (chainId === 421614 ? "deployments/arbitrum-sepolia.json" : "deployments/arbitrum-mainnet.json"));
const { ethers } = await network.connect();
const provider = ethers.provider;
const [deployer] = await ethers.getSigners();
if (!deployer) throw new Error("No deployer signer is configured. Set PRIVATE_KEY.");

const networkInfo = await provider.getNetwork();
if (networkInfo.chainId !== BigInt(chainId)) throw new Error(`Refusing deployment: expected chain ${chainId}, got ${networkInfo.chainId}`);

const deployerAddress = await deployer.getAddress();
const balance = await provider.getBalance(deployerAddress);
if (balance === 0n && process.env.REQUIRE_DEPLOYER_FUNDS === "true") throw new Error("Deployer has zero native balance and REQUIRE_DEPLOYER_FUNDS=true.");

const aave = address("AAVE_V3_POOL");
const balancer = optionalAddress("BALANCER_VAULT");
const relayer = address("RELAYER_ADDRESS");
const name = process.env.EIP712_NAME || "AegisEngine";
const version = process.env.EIP712_VERSION || "1";
if (name !== "AegisEngine" || version !== "1") throw new Error("EIP712_NAME/EIP712_VERSION must be AegisEngine/1; the contract domain is immutable.");

const factory = await ethers.getContractFactory("AegisFlashLoanExecutor");
const contract = await factory.deploy(aave, balancer || ethers.ZeroAddress, deployerAddress);
const deploymentTx = contract.deploymentTransaction();
if (!deploymentTx) throw new Error("Deployment transaction was not created.");
await contract.waitForDeployment();
const executor = await contract.getAddress();
const receipt = await deploymentTx.wait();
if (!receipt) throw new Error("Deployment receipt was not mined.");

await (await contract.setRelayer(relayer, true)).wait();
await (await contract.setTarget(aave, true)).wait();
if (balancer) if (balancer) await (await contract.setTarget(balancer, true)).wait();

for (const [targetName, selectorName] of [["UNISWAP_V2_ROUTER","UNISWAP_V2_SELECTOR"],["UNISWAP_V3_ROUTER","UNISWAP_V3_SELECTOR"]] as const) {
  const target = optionalAddress(targetName);
  const selector = optionalSelector(selectorName);
  if ((target && !selector) || (!target && selector)) throw new Error(`${targetName} and ${selectorName} must be supplied together.`);
  if (target && selector) { await (await contract.setTarget(target, true)).wait(); await (await contract.setSelector(target, selector, true)).wait(); }
}

const domainSeparator = await contract.DOMAIN_SEPARATOR();
if (!(await contract.authorizedRelayers(relayer))) throw new Error("Relayer authorization postcondition failed.");
if ((await contract.AAVE_POOL()).toLowerCase() !== aave.toLowerCase()) throw new Error("Aave endpoint postcondition failed.");
if ((await contract.BALANCER_VAULT()).toLowerCase() !== (balancer || ethers.ZeroAddress).toLowerCase()) throw new Error("Balancer endpoint postcondition failed.");

let bytecodeBytes: number | null = null;
try { const artifact = JSON.parse(await readFile(artifactPath, "utf8")); bytecodeBytes = artifact.deployedBytecode ? (artifact.deployedBytecode.length - 2) / 2 : null; } catch {}

const record = {
  network: chainId === 421614 ? "arbitrum-sepolia" : "arbitrum", chainId, contract: "AegisFlashLoanExecutor", address: executor,
  deployer: deployerAddress, relayer, constructorArgs: [aave, balancer || ethers.ZeroAddress, deployerAddress],
  deploymentTransaction: deploymentTx.hash, blockNumber: receipt.blockNumber,
  eip712: { name: "AegisEngine", version: "1", domainSeparator }, endpoints: { aave, balancer: balancer || null },
  bytecodeBytes, deployedAt: new Date().toISOString()
};
await mkdir(resolve("deployments"), { recursive: true });
await writeFile(deploymentPath, JSON.stringify(record, null, 2) + "
", "utf8");
console.log(JSON.stringify(record, null, 2));
