import {BaseStrategy,MarketState,Signal,FillEvent} from "./BaseStrategy";
export type QuantTrendConfig={zEntry:number;breakoutThreshold:number;stopLossPct:number;takeProfitPct:number;trailingStopPct:number;capital:number};
export class QuantTrendStrategy extends BaseStrategy{
 readonly id="quant-trend"; private peak=0;
 constructor(private readonly c:QuantTrendConfig){super();}
 evaluate_signals(m:MarketState):Signal[]{const z=m.spreadZScore??0,trend=m.trendStrength??0;let side:"BUY"|"SELL"|null=null;if(z<=-this.c.zEntry||trend>=this.c.breakoutThreshold)side="BUY";else if(z>=this.c.zEntry||trend<=-this.c.breakoutThreshold)side="SELL";if(!side)return[];const q=this.c.capital/Math.max(m.price,1);return[{strategyId:this.id,symbol:m.symbol,side,quantity:q,expectedYield:this.calculate_expected_yield(m),confidence:Math.min(1,Math.max(Math.abs(z)/this.c.zEntry,Math.abs(trend)/this.c.breakoutThreshold)),stopLoss:side==="BUY"?m.price*(1-this.c.stopLossPct):m.price*(1+this.c.stopLossPct),takeProfit:side==="BUY"?m.price*(1+this.c.takeProfitPct):m.price*(1-this.c.takeProfitPct),metadata:{trailingStopPct:this.c.trailingStopPct}}];}
 calculate_expected_yield(m:MarketState):number{return Math.max(Math.abs(m.spreadZScore??0)*0.001,Math.abs(m.trendStrength??0)*0.001)-Math.abs(m.ask-m.bid)/Math.max(m.price,1);}
 get_required_capital():number{return this.c.capital;}
 on_execution_update(f:FillEvent):void{this.peak=Math.max(this.peak,f.price);}
}