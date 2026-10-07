export type EquitySnapshot={timestamp:number;equity:number;startingCapital:number;grossPnl:number;fees:number;slippage:number};
export type SweepRecord={timestamp:number;startingCapital:number;highWaterMark:number;currentEquity:number;netPnl:number;harvestPct:number;sweptAmount:number};
export interface PayoutGateway{transfer(asset:string,amount:number,destination:string):Promise<string>;}
export class ProfitSweeper{
 private highWaterMark:number;
 constructor(private readonly gateway:PayoutGateway,initialEquity:number,private readonly harvestPct:number,private readonly destination:string,private readonly asset:string){if(harvestPct<0||harvestPct>1)throw new Error("INVALID_HARVEST_PCT");this.highWaterMark=initialEquity;}
 async evaluate(snapshot:EquitySnapshot):Promise<SweepRecord>{this.highWaterMark=Math.max(this.highWaterMark,snapshot.equity);const netPnl=snapshot.equity-this.highWaterMark;const sweep=Math.max(0,netPnl*this.harvestPct);let sweptAmount=0;if(sweep>0)sweptAmount=sweep;return{timestamp:Date.now(),startingCapital:snapshot.startingCapital,highWaterMark:this.highWaterMark,currentEquity:snapshot.equity,netPnl,harvestPct:this.harvestPct,sweptAmount};}
 async harvest(snapshot:EquitySnapshot):Promise<SweepRecord>{const record=await this.evaluate(snapshot);if(record.sweptAmount<=0)return record;await this.gateway.transfer(this.asset,record.sweptAmount,this.destination);return record;}
 getHighWaterMark(){return this.highWaterMark;}
}