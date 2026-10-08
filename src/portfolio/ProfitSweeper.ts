export type EquitySnapshot={timestamp:number;equity:number;startingCapital:number;grossPnl:number;fees:number;slippage:number};
export type SweepRecord={timestamp:number;startingCapital:number;highWaterMark:number;currentEquity:number;netPnl:number;harvestPct:number;sweptAmount:number};
export interface PayoutGateway{transfer(asset:string,amount:number,destination:string):Promise<string>;}
export class ProfitSweeper{
 private highWaterMark:number;
 constructor(private readonly gateway:PayoutGateway,initialEquity:number,private readonly harvestPct:number,private readonly destination:string,private readonly asset:string){
  if(!Number.isFinite(initialEquity)||initialEquity<0)throw new Error("INVALID_INITIAL_EQUITY");
  if(harvestPct<0||harvestPct>1)throw new Error("INVALID_HARVEST_PCT");
  if(!destination)throw new Error("INVALID_DESTINATION");
  this.highWaterMark=initialEquity;
 }
 async evaluate(snapshot:EquitySnapshot):Promise<SweepRecord>{
  if(!Number.isFinite(snapshot.equity)||snapshot.equity<0)throw new Error("INVALID_EQUITY");
  const previousHighWaterMark=this.highWaterMark;
  const netPnl=snapshot.equity-previousHighWaterMark;
  const sweptAmount=Math.max(0,netPnl*this.harvestPct);
  this.highWaterMark=Math.max(previousHighWaterMark,snapshot.equity);
  return{timestamp:Date.now(),startingCapital:snapshot.startingCapital,highWaterMark:this.highWaterMark,currentEquity:snapshot.equity,netPnl,harvestPct:this.harvestPct,sweptAmount};
 }
 async harvest(snapshot:EquitySnapshot):Promise<SweepRecord>{
  const record=await this.evaluate(snapshot);
  if(record.sweptAmount<=0)return record;
  await this.gateway.transfer(this.asset,record.sweptAmount,this.destination);
  return record;
 }
 getHighWaterMark(){return this.highWaterMark;}
}