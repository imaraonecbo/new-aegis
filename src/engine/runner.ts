import { simulatePrivate } from "../simulators/ethSimulate.js";
import { submitPrivate } from "../mev/relayerRouter.js";
import { assertExecutionSigner, ExecutionIntent } from "../crypto/signer.js";
import { env } from "../config/env.js";
import { executeGaslessCall } from "../aa/gaslessExecution.js";
import { evaluateExecutionRisk, ExecutionRiskSnapshot, panicActive, recordSimulationFailure, recordSuccessfulExecution } from "../risk/profitabilityShield.js";

export type FiveGateOpportunity = {
  from: string;
  to: string;
  calldata: string;
  rawTransaction: string;
  targetBlock: number;
  netProfitUsd: number;
  minProfitUsd: number;
  intent: ExecutionIntent;
  signature: string;
  expectedSigner: string;
  risk: ExecutionRiskSnapshot;
  simulationData?: string;
};

export async function executeFiveGates(o: FiveGateOpportunity) {
  if (!env.ENGINE_ENABLED || env.ENGINE_DRY_RUN) throw new Error("GATE_0: engine disabled or dry-run");
  if (panicActive()) throw new Error("RISK_PANIC: execution halted");
  if (o.netProfitUsd < Math.max(env.MIN_PROFIT_USD, o.minProfitUsd)) throw new Error("GATE_1: profitability failed");

  const risk = evaluateExecutionRisk(o.risk);
  if (!risk.approved) throw new Error(`RISK_GATE: ${risk.reason}`);
  if (risk.netProfitUsd + 1e-9 < o.netProfitUsd - 1e-9) throw new Error("RISK_GATE: supplied profit exceeds risk-engine profit");
  if (o.targetBlock <= 0 || o.targetBlock !== Number(o.intent.targetBlock)) throw new Error("GATE_2: target block binding failed");
  assertExecutionSigner(o.intent, o.signature, o.expectedSigner);

  if (env.AA_ENABLED) {
    if (o.intent.feeRecipient.toLowerCase() !== o.intent.relayer.toLowerCase()) throw new Error("GATE_AA: fee recipient must equal AA relayer");
    try {
      const result = await executeGaslessCall({
        to: o.to,
        data: o.calldata,
        netProfitUsd: o.netProfitUsd,
        expectedRelayer: o.intent.relayer
      });
      return result;
    } catch (error) {
      recordSimulationFailure();
      throw error;
    }
  }

  try {
    await simulatePrivate({ from: o.from, to: o.to, data: o.simulationData ?? o.calldata });
    recordSuccessfulExecution();
  } catch (error) {
    recordSimulationFailure();
    throw error;
  }
  if (!o.rawTransaction) throw new Error("GATE_4: signed raw transaction missing");
  if (!env.PRIVATE_SUBMISSION_REQUIRED) throw new Error("GATE_5: private submission disabled");
  return submitPrivate(o.rawTransaction, o.targetBlock);
}