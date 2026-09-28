// @ts-nocheck
import "dotenv/config";
import hre from "hardhat";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";

const deploymentPath = resolve(process.env.DEPLOYMENT_FILE || "deployments/arbitrum-mainnet.json");
const deployment = JSON.parse(await readFile(deploymentPath, "utf8"));
if (!process.env.ARBISCAN_API_KEY) throw new Error("ARBISCAN_API_KEY is required.");
if (!deployment.address || deployment.constructorArgs?.length !== 3) throw new Error("Invalid deployment artifact.");

const result = await verifyContract({
  address: deployment.address,
  constructorArgs: deployment.constructorArgs,
  provider: "etherscan",
}, hre);

console.log(JSON.stringify(result ?? { verified: true, address: deployment.address }, null, 2));
