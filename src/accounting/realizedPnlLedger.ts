export type Settlement = {
  executionId: string;
  asset: string;
  grossProceeds: number;
  principalRepaid: number;
  flashLoanFee: number;
  tradingFees: number;
  gasCost: number;
  relayerCost: number;
  slippageCost: number;
  otherCosts: number;
  destination: string;
  txHash: string;
};

export type RealizedPnl = Settlement & {
  realizedProfit: number;
};

export class RealizedPnlLedger {
  private readonly settlements = new Map<string, RealizedPnl>();

  settle(s: Settlement): RealizedPnl {
    if (!s.executionId || !s.txHash || !s.destination) throw new Error("INVALID_SETTLEMENT_IDENTITY");
    if (this.settlements.has(s.executionId)) throw new Error("DUPLICATE_SETTLEMENT");
    const fields = [
      s.grossProceeds, s.principalRepaid, s.flashLoanFee, s.tradingFees,
      s.gasCost, s.relayerCost, s.slippageCost, s.otherCosts
    ];
    if (fields.some(v => !Number.isFinite(v) || v < 0)) throw new Error("INVALID_SETTLEMENT_AMOUNT");
    const realizedProfit =
      s.grossProceeds - s.principalRepaid - s.flashLoanFee - s.tradingFees -
      s.gasCost - s.relayerCost - s.slippageCost - s.otherCosts;
    const result = { ...s, realizedProfit };
    this.settlements.set(s.executionId, result);
    return result;
  }

  get(executionId: string): RealizedPnl | undefined {
    return this.settlements.get(executionId);
  }

  totalRealizedProfit(): number {
    return [...this.settlements.values()].reduce((sum, x) => sum + x.realizedProfit, 0);
  }
}
