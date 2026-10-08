import { strict as assert } from "node:assert";
import { before } from "mocha";

process.env.NODE_ENV = "test";
process.env.CHAIN_ID = "42161";
process.env.ARBITRUM_RPC_URL = "https://example.com/rpc";
process.env.ARBITRUM_SIMULATION_RPC_URL = "https://example.com/sim";
process.env.ARBITRUM_PRIVATE_RPC_URL = "https://example.com/private";
process.env.EXECUTOR_ADDRESS = "0x0000000000000000000000000000000000000001";
process.env.EXECUTION_SIGNER_PRIVATE_KEY = "0x" + "11".repeat(32);
process.env.ENGINE_ENABLED = "false";
process.env.ENGINE_DRY_RUN = "true";
process.env.RISK_PANIC_ENABLED = "false";
process.env.AEGIS_RISK_STATE_FILE = "runtime/test-profitability-risk.json";
process.env.AEGIS_PANIC_FILE = "runtime/test-profitability-panic";

let shield: typeof import("../src/risk/profitabilityShield.js");

before(async () => {
  shield = await import("../src/risk/profitabilityShield.js");
});

const base = () => ({
  quoteTimestampMs: Date.now(),
  quoteBlock: 100,
  currentBlock: 100,
  targetBlock: 101,
  expectedGrossProfitUsd: 50,
  principalUsd: 500,
  dexFeesUsd: 2,
  flashLoanFeeUsd: 1,
  gasCostUsd: 2,
  gasReserveUsd: 3,
  aaFeeUsd: 1,
  slippageBps: 10,
  priceImpactBps: 10,
  priceMoveBps: 5
});

describe("Aegis profitability shield", () => {
  it("approves only when conservative net economics pass", () => {
    const result = shield.evaluateExecutionRisk(base());
    assert.equal(result.approved, true);
    assert.equal(result.reason, "RISK_APPROVED");
    assert.equal(result.netProfitUsd, 41);
  });

  it("rejects stale quotes", () => {
    const s = base();
    s.quoteTimestampMs = Date.now() - 10_000;
    assert.equal(shield.evaluateExecutionRisk(s).reason, "RISK_QUOTE_STALE");
  });

  it("rejects excessive slippage", () => {
    const s = base();
    s.slippageBps = 31;
    assert.equal(shield.evaluateExecutionRisk(s).reason, "RISK_SLIPPAGE_TOO_HIGH");
  });

  it("rejects insufficient worst-case gas reserve", () => {
    const s = base();
    s.gasReserveUsd = 2.9;
    assert.equal(shield.evaluateExecutionRisk(s).reason, "RISK_GAS_RESERVE_INSUFFICIENT");
  });

  it("rejects an expired target block", () => {
    const s = base();
    s.targetBlock = 100;
    assert.equal(shield.evaluateExecutionRisk(s).reason, "RISK_TARGET_BLOCK_MISMATCH");
  });

  it("rejects economics below the configured profit floor", () => {
    const s = base();
    s.expectedGrossProfitUsd = 10;
    assert.equal(shield.evaluateExecutionRisk(s).reason, "RISK_NET_PROFIT_TOO_LOW");
  });
});
