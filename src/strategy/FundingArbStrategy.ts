import {BaseStrategy,MarketState,Signal,FillEvent} from "./BaseStrategy";
export type FundingArbConfig={minFundingThreshold:number;minAnnualizedYield:number;capital:number;rebalanceDriftPct:number;liquidationSafetyRatio:number};
export class FundingArbStrategy extends BaseStrategy{
 readonly id="funding-arb"; private delta=0; private lastFill?:FillEvent;
 constructor(private readonly c:FundingArbConfig){super();}
 evaluate_signals(m:MarketState):Signal[]{if(m.fundingRate8h<this.c.minFundingThreshold||this.calculate_expected_yield(m)<this.c.minAnnualizedYield)return[];const q=this.c.capital/(m.price||1);return[{strategyId:this.id,symbol:m.symbol,side:"BUY",quantity:q,expectedYield:this.calculate_expected_yield(m),confidence:Math.min(1,m.fundingRate8h/this.c.minFundingThreshold),metadata:{legs:"spot-long/perp-short",fundingRate8h:m.fundingRate8h}}];}
 calculate_expected_yield(m:MarketState):number{const friction=((m.ask-m.bid)/(m.price||1))*2;return m.fundingAnnualized-friction;}
 get_required_capital():number{return this.c.capital;}
 on_execution_update(f:FillEvent):void{this.lastFill=f;this.delta+=f.side==="BUY"?f.quantity:-f.quantity;}
 shouldRebalance(spotQty:number,perpQty:number):boolean{return Math.abs(spotQty-perpQty)/Math.max(spotQty,perpQty,1)>this.c.rebalanceDriftPct;}
 isLiquidationSafe(marginRatio:number):boolean{return marginRatio>=this.c.liquidationSafetyRatio;}
}