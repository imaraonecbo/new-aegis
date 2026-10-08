import { expect } from "chai";
import { TradingEngine } from "../src/engine/tradingEngine.js";
import { BaseStrategy, MarketState, Signal, FillEvent } from "../src/strategy/BaseStrategy.js";
import { PortfolioManager } from "../src/portfolio/PortfolioManager.js";
import { ExecutionLifecycle } from "../src/execution/executionLifecycle.js";
import { RealizedPnlLedger } from "../src/accounting/realizedPnlLedger.js";

class TestStrategy extends BaseStrategy {
  readonly id = "test";
  evaluate_signals(_m: MarketState): Signal[] {
    return [{ strategyId: this.id, symbol: "WETH/USDC", side: "BUY", quantity: 1, expectedYield: 0.02, confidence: 0.9, metadata: {} }];
  }
  calculate_expected_yield(_m: MarketState): number { return 0.02; }
  get_required_capital(): number { return 100; }
  on_execution_update(_f: FillEvent): void {}
}

describe("Aegis integrated trading primitives", () => {
  it("produces a validated signal with portfolio allocation", () => {
    const portfolio = new PortfolioManager({
      maxStrategyCapital: { test: 1000, "funding-arb": 0, "market-maker": 0, "quant-trend": 0 },
      reservePct: 0.1, fundingWeight: 0, marketMakerWeight: 0, trendWeight: 0
    });
    const engine = new TradingEngine([new TestStrategy()], portfolio);
    const market: MarketState = {
      symbol: "WETH/USDC", price: 2000, bid: 1999, ask: 2001, atr: 20,
      volatility: 0.02, fundingRate8h: 0, fundingAnnualized: 0, timestamp: Date.now()
    };
    const decisions = engine.evaluate(market, 1000);
    expect(decisions[0].status).to.equal("READY");
  });

  it("rejects illegal lifecycle jumps", () => {
    const lifecycle = new ExecutionLifecycle("exec-1");
    lifecycle.transition("QUALIFIED");
    expect(() => lifecycle.transition("SETTLED")).to.throw("INVALID_EXECUTION_TRANSITION");
    lifecycle.transition("RISK_APPROVED");
    lifecycle.transition("BUILT");
    lifecycle.transition("SIMULATED");
    lifecycle.transition("SUBMITTED");
    lifecycle.transition("CONFIRMED");
    lifecycle.transition("RECONCILED");
    lifecycle.transition("SETTLED");
    expect(lifecycle.current()).to.equal("SETTLED");
  });

  it("records only reconciled settlement economics as realized P&L", () => {
    const ledger = new RealizedPnlLedger();
    const result = ledger.settle({
      executionId: "exec-2",
      asset: "WETH",
      grossProceeds: 1.05,
      principalRepaid: 1,
      flashLoanFee: 0.001,
      tradingFees: 0.002,
      gasCost: 0.001,
      relayerCost: 0.001,
      slippageCost: 0.001,
      otherCosts: 0,
      destination: "0x0000000000000000000000000000000000000001",
      txHash: "0xabc"
    });
    expect(result.realizedProfit).to.equal(0.044);
    expect(ledger.totalRealizedProfit()).to.equal(0.044);
  });
});
