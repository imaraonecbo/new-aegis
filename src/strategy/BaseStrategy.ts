export type MarketState={symbol:string;price:number;bid:number;ask:number;atr:number;volatility:number;fundingRate8h:number;fundingAnnualized:number;spreadZScore?:number;trendStrength?:number;orderBookImbalance?:number;timestamp:number};
export type Signal={strategyId:string;symbol:string;side:"BUY"|"SELL";quantity:number;expectedYield:number;confidence:number;stopLoss?:number;takeProfit?:number;metadata:Record<string,unknown>};
export type FillEvent={strategyId:string;symbol:string;side:"BUY"|"SELL";quantity:number;price:number;fee:number;timestamp:number};
export abstract class BaseStrategy{
  abstract readonly id:string;
  abstract evaluate_signals(market_data:MarketState):Signal[];
  abstract calculate_expected_yield(market_data:MarketState):number;
  abstract get_required_capital():number;
  abstract on_execution_update(trade_fill:FillEvent):void;
  protected netYield(gross:number,fees:number,slippage:number,funding:number=0):number{return gross-fees-slippage-funding;}
}