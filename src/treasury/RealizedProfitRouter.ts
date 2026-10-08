import { RealizedPnlLedger, Settlement } from "../accounting/realizedPnlLedger.js";

export interface TreasuryTransferGateway {
  transferRealizedProfit(asset: string, amount: number, destination: string, executionId: string): Promise<string>;
}

export class RealizedProfitRouter {
  constructor(
    private readonly ledger: RealizedPnlLedger,
    private readonly gateway: TreasuryTransferGateway,
    private readonly destination: string
  ) {
    if (!destination) throw new Error("TREASURY_DESTINATION_REQUIRED");
  }

  async settleAndRoute(settlement: Settlement): Promise<{ realizedProfit: number; transferId?: string }> {
    const result = this.ledger.settle(settlement);
    if (result.realizedProfit <= 0) return { realizedProfit: result.realizedProfit };

    const transferId = await this.gateway.transferRealizedProfit(
      result.asset,
      result.realizedProfit,
      this.destination,
      result.executionId
    );
    return { realizedProfit: result.realizedProfit, transferId };
  }
}
