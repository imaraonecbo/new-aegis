import {BaseStrategy,MarketState,Signal,FillEvent} from "../strategy/BaseStrategy";
export type Regime="FUNDING_LOW_VOL"|"RANGE_LOW_VOL"|"HIGH_VOL_BREAKOUT"|"NEUTRAL";
export type Allocation={strategyId:string;weight:number;capital:number};
export type PortfolioConfig={maxStrategyCapital:Record<string,number>;reservePct:number;fundingWeight:number;marketMakerWeight:number;trendWeight:number};
export class PortfolioManager{
 constructor(private readonly c:PortfolioConfig){}
 detectRegime(m:MarketState):Regime{if(m.fundingRate8h>0.0001&&m.volatility<0.03)return"FUNDING_LOW_VOL";if(m.volatility<0.02&&Math.abs(m.orderBookImbalance??0)<0.2)return"RANGE_LOW_VOL";if(m.volatility>=0.05&&(m.trendStrength??0)>=0.7)return"HIGH_VOL_BREAKOUT";return"NEUTRAL";}
 allocate(totalCapital:number,m:MarketState):Allocation[]{const reserve=totalCapital*this.c.reservePct;const investable=Math.max(0,totalCapital-reserve);const regime=this.detectRegime(m);let weights:Record<string,number>;if(regime==="FUNDING_LOW_VOL")weights={"funding-arb":this.c.fundingWeight,"market-maker":Math.max(0,1-this.c.fundingWeight),"quant-trend":0};else if(regime==="RANGE_LOW_VOL")weights={"funding-arb":Math.max(0,1-this.c.marketMakerWeight),"market-maker":this.c.marketMakerWeight,"quant-trend":0};else if(regime==="HIGH_VOL_BREAKOUT")weights={"funding-arb":0,"market-maker":0,"quant-trend":1};else weights={"funding-arb":.34,"market-maker":.33,"quant-trend":.33};return Object.entries(weights).map(([strategyId,w])=>({strategyId,weight:w,capital:Math.min(investable*w,this.c.maxStrategyCapital[strategyId]??0)}));}
}