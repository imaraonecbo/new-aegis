export type DepthQuote={size:number;buyOut:number;sellOut:number;impactBps:number};
export const REQUIRED_DEPTH_MULTIPLIERS=[0.25,0.5,0.8,1.0] as const;
export function evaluateDepth(q:DepthQuote[],gasUsd:number,flashFeeUsd:number,l1DataUsd:number,minProfitUsd:number){
 if(q.length!==4||q.some((x,i)=>Math.abs(x.size-(q[3]?.size??0)*REQUIRED_DEPTH_MULTIPLIERS[i])>1e-12))throw new Error("Liquidity gate requires exact 0.25x/0.5x/0.8x/1.0x probes");
 const edge=q[3].sellOut-q[3].buyOut-gasUsd-flashFeeUsd-l1DataUsd;
 const worstImpact=Math.max(...q.map(x=>x.impactBps));
 return {edge,worstImpactBps:worstImpact,profitable:edge>=minProfitUsd&&worstImpact<=100};
}
export function arbitrumFeeUsd(l2GasUsed:bigint,l2GasPriceWei:bigint,l1FeeWei:bigint,ethUsd:number){return Number(l2GasUsed*l2GasPriceWei+l1FeeWei)/1e18*ethUsd;}