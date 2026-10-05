import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

export type ExecutionRiskSnapshot = {
  quoteTimestampMs: number;
  quoteBlock: number;
  currentBlock: number;
  targetBlock: number;
  expectedGrossProfitUsd: number;
  principalUsd: number;
  dexFeesUsd: number;
  flashLoanFeeUsd: number;
  gasCostUsd: number;
  gasReserveUsd: number;
  aaFeeUsd: number;
  slippageBps: number;
  priceImpactBps: number;
  priceMoveBps: number;
  expectedOutputUsd?: number;
};

export type RiskDecision = {
  approved: boolean;
  reason: string;
  netProfitUsd: number;
  totalCostsUsd: number;
};

type RiskState = {
  day: string;
  realizedPnlUsd: number;
  consecutiveFailures: number;
};

const numberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const boolEnv = (name: string, fallback: boolean) => {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const MAX_QUOTE_AGE_MS = numberEnv("MAX_QUOTE_AGE_MS", 1500);
const MAX_PRICE_MOVE_BPS = numberEnv("MAX_PRICE_MOVE_BPS", 25);
const MAX_SLIPPAGE_BPS = numberEnv("MAX_SLIPPAGE_BPS", 30);
const MAX_PRICE_IMPACT_BPS = numberEnv("MAX_PRICE_IMPACT_BPS", 50);
const GAS_RESERVE_MULTIPLIER = numberEnv("GAS_RESERVE_MULTIPLIER", 1.5);
const MAX_CONSECUTIVE_FAILURES = Math.max(1, Math.floor(numberEnv("MAX_CONSECUTIVE_FAILURES", 3)));
const DAILY_LOSS_LIMIT_USD = numberEnv("DAILY_LOSS_LIMIT_USD", 25);
const MAX_TRADE_USD = env.MAX_TRADE_USD;

const stateFile = path.resolve(process.env.AEGIS_RISK_STATE_FILE ?? "runtime/aegis-risk-state.json");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): RiskState {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as Partial<RiskState>;
    if (parsed.day === today()) {
      return {
        day: parsed.day,
        realizedPnlUsd: Number(parsed.realizedPnlUsd) || 0,
        consecutiveFailures: Number(parsed.consecutiveFailures) || 0
      };
    }
  } catch {}
  return { day: today(), realizedPnlUsd: 0, consecutiveFailures: 0 };
}

function saveState(state: RiskState): void {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const temp = stateFile + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(temp, stateFile);
}

export function evaluateExecutionRisk(snapshot: ExecutionRiskSnapshot): RiskDecision {
  const requiredProfit = Math.max(env.MIN_PROFIT_USD, snapshot.principalUsd * env.MIN_PROFIT_BPS / 10_000);

  if (!Number.isFinite(snapshot.quoteTimestampMs) || Date.now() - snapshot.quoteTimestampMs > MAX_QUOTE_AGE_MS) {
    return { approved: false, reason: "RISK_QUOTE_STALE", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.currentBlock > snapshot.targetBlock) {
    return { approved: false, reason: "RISK_TARGET_BLOCK_EXPIRED", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.targetBlock !== snapshot.currentBlock + env.TARGET_BLOCK_OFFSET) {
    return { approved: false, reason: "RISK_TARGET_BLOCK_MISMATCH", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.quoteBlock > snapshot.currentBlock) {
    return { approved: false, reason: "RISK_QUOTE_BLOCK_INVALID", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.priceMoveBps > MAX_PRICE_MOVE_BPS) {
    return { approved: false, reason: "RISK_PRICE_MOVED", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.slippageBps > MAX_SLIPPAGE_BPS) {
    return { approved: false, reason: "RISK_SLIPPAGE_TOO_HIGH", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.priceImpactBps > MAX_PRICE_IMPACT_BPS) {
    return { approved: false, reason: "RISK_PRICE_IMPACT_TOO_HIGH", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  if (snapshot.principalUsd <= 0 || snapshot.principalUsd > MAX_TRADE_USD) {
    return { approved: false, reason: "RISK_TRADE_SIZE", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  const requiredGasReserve = snapshot.gasCostUsd * GAS_RESERVE_MULTIPLIER;
  if (snapshot.gasReserveUsd < requiredGasReserve) {
    return { approved: false, reason: "RISK_GAS_RESERVE_INSUFFICIENT", netProfitUsd: 0, totalCostsUsd: 0 };
  }

  const totalCostsUsd =
    snapshot.dexFeesUsd +
    snapshot.flashLoanFeeUsd +
    snapshot.gasCostUsd +
    snapshot.gasReserveUsd +
    snapshot.aaFeeUsd;

  const netProfitUsd = snapshot.expectedGrossProfitUsd - totalCostsUsd;
  const netProfitBps = snapshot.principalUsd > 0
    ? (netProfitUsd / snapshot.principalUsd) * 10_000
    : -Infinity;

  const state = loadState();

  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return { approved: false, reason: "RISK_CIRCUIT_BREAKER", netProfitUsd, totalCostsUsd };
  }

  if (state.realizedPnlUsd <= -DAILY_LOSS_LIMIT_USD) {
    return { approved: false, reason: "RISK_DAILY_LOSS_LIMIT", netProfitUsd, totalCostsUsd };
  }

  if (netProfitUsd < requiredProfit) {
    return { approved: false, reason: "RISK_NET_PROFIT_TOO_LOW", netProfitUsd, totalCostsUsd };
  }

  if (netProfitBps < env.MIN_PROFIT_BPS) {
    return { approved: false, reason: "RISK_NET_PROFIT_BPS_TOO_LOW", netProfitUsd, totalCostsUsd };
  }

  return { approved: true, reason: "RISK_APPROVED", netProfitUsd, totalCostsUsd };
}

export function recordSimulationFailure(): void {
  const state = loadState();
  state.consecutiveFailures += 1;
  saveState(state);
}

export function recordSuccessfulExecution(): void {
  const state = loadState();
  state.consecutiveFailures = 0;
  saveState(state);
}

export function reconcileExecution(realizedPnlUsd: number): void {
  if (!Number.isFinite(realizedPnlUsd)) throw new Error("RISK_RECONCILIATION_INVALID_PNL");
  const state = loadState();
  state.realizedPnlUsd += realizedPnlUsd;
  state.consecutiveFailures = 0;
  saveState(state);
}

export function riskStatus() {
  const state = loadState();
  return {
    ...state,
    dailyLossLimitUsd: DAILY_LOSS_LIMIT_USD,
    circuitBreakerThreshold: MAX_CONSECUTIVE_FAILURES,
    maxQuoteAgeMs: MAX_QUOTE_AGE_MS,
    maxPriceMoveBps: MAX_PRICE_MOVE_BPS,
    maxSlippageBps: MAX_SLIPPAGE_BPS,
    maxPriceImpactBps: MAX_PRICE_IMPACT_BPS,
    gasReserveMultiplier: GAS_RESERVE_MULTIPLIER,
    maxTradeUsd: MAX_TRADE_USD
  };
}

export function panicActive(): boolean {
  if (!boolEnv("RISK_PANIC_ENABLED", true)) return false;
  return fs.existsSync(path.resolve(env.AEGIS_PANIC_FILE));
}
