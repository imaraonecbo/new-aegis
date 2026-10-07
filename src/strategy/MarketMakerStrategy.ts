import {BaseStrategy,MarketState,Signal,FillEvent} from "./BaseStrategy";
export type MarketMakerConfig={baseSpreadBps:number;volatilityMultiplier:number;inventorySkewBps:number;requoteThresholdBps:number;capital:number;orderNotional:number};
export class MarketMakerStrategy extends BaseStrategy{
 readonly id="market-maker"; private inventory=0;
 constructor(private readonly c:MarketMakerConfig){super();}
 private spread(m:MarketState){return this.c.baseSpreadBps/10000+this.c.volatilityMultiplier*m.atr/Math.max(m.price,1);}
 evaluate_signals(m:MarketState):Signal[]{const s=this.spread(m);const skew=this.inventory*this.c.inventorySkewBps/10000;const mid=(m.bid+m.ask)/2;const bid=mid*(1-s-skew),ask=mid*(1+s-skew);const q=this.c.orderNotional/Math.max(mid,1);return[{strategyId:this.id,symbol:m.symbol,side:"BUY",quantity:q,expectedYield:this.calculate_expected_yield(m),confidence:.5,metadata:{orderType:"POST_ONLY",price:bid}},{strategyId:this.id,symbol:m.symbol,side:"SELL",quantity:q,expectedYield:this.calculate_expected_yield(m),confidence:.5,metadata:{orderType:"POST_ONLY",price:ask}}];}
 calculate_expected_yield(m:MarketState):number{return this.spread(m)-(m.bid>0?(m.ask-m.bid)/m.bid:0);}
 get_required_capital():number{return this.c.capital;}
 on_execution_update(f:FillEvent):void{this.inventory+=f.side==="BUY"?f.quantity:-f.quantity;}
 isStale(midMoveBps:number):boolean{return Math.abs(midMoveBps)>=this.c.requoteThresholdBps;}
}