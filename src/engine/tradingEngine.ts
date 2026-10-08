import { BaseStrategy, MarketState, Signal, FillEvent } from "../strategy/BaseStrategy.js";
import { PortfolioManager, Allocation } from "../portfolio/PortfolioManager.js";

export type ExecutionDecision =
  | { status: "REJECTED"; reason: string; signals: Signal[]; allocations: Allocation[] }
  | { status: "READY"; signal: Signal; allocation: Allocation; expectedNetYield: number; reason: string };

export type EngineConfig = {
  minConfidence: number;
  maxSignalsPerCycle: number;
};

export class TradingEngine {
  constructor(
    private readonly strategies: BaseStrategy[],
    private readonly portfolio: PortfolioManager,
    private readonly config: EngineConfig = { minConfidence: 0.55, maxSignalsPerCycle: 3 }
  ) {}

  evaluate(market: MarketState, totalCapital: number): ExecutionDecision[] {
    if (!Number.isFinite(totalCapital) || totalCapital < 0) {
      return [{ status: "REJECTED", reason: "INVALID_PORTFOLIO_CAPITAL", signals: [], allocations: [] }];
    }

    const allocations = this.portfolio.allocate(totalCapital, market);
    const allocationByStrategy = new Map(allocations.map(a => [a.strategyId, a]));
    const signals = this.strategies.flatMap(s => s.evaluate_signals(market))
      .filter(s => Number.isFinite(s.expectedYield) && Number.isFinite(s.confidence))
      .sort((a, b) => (b.expectedYield * b.confidence) - (a.expectedYield * a.confidence))
      .slice(0, this.config.maxSignalsPerCycle);

    if (signals.length === 0) {
      return [{ status: "REJECTED", reason: "NO_VALID_SIGNAL", signals: [], allocations }];
    }

    return signals.map(signal => {
      const allocation = allocationByStrategy.get(signal.strategyId);
      if (!allocation || allocation.capital <= 0) {
        return { status: "REJECTED" as const, reason: "NO_ALLOCATED_CAPITAL", signals: [signal], allocations };
      }
      if (signal.confidence < this.config.minConfidence) {
        return { status: "REJECTED" as const, reason: "SIGNAL_CONFIDENCE_BELOW_THRESHOLD", signals: [signal], allocations };
      }
      if (signal.quantity <= 0 || !Number.isFinite(signal.quantity)) {
        return { status: "REJECTED" as const, reason: "INVALID_SIGNAL_SIZE", signals: [signal], allocations };
      }
      return {
        status: "READY" as const,
        signal,
        allocation,
        expectedNetYield: signal.expectedYield,
        reason: "SIGNAL_AND_ALLOCATION_VALID"
      };
    });
  }

  notifyFill(fill: FillEvent): void {
    const strategy = this.strategies.find(s => s.id === fill.strategyId);
    if (!strategy) throw new Error(`UNKNOWN_STRATEGY:${fill.strategyId}`);
    strategy.on_execution_update(fill);
  }
}
