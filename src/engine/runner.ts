import {env} from "../config/env";import {simulatePrivate} from "../simulators/ethSimulate";import {submitPrivate} from "../mev/relayerRouter";
export type Opportunity={target:string;calldata:string;from:string;targetBlock:number;netProfitUsd:number;minProfitUsd:number};
export async function executeFiveGates(o:Opportunity){
 if(!env.ENGINE_ENABLED||env.ENGINE_DRY_RUN)throw new Error("Execution disabled");
 if(o.netProfitUsd<o.minProfitUsd)throw new Error("Gate 1/2 failed: economics");
 if(o.targetBlock!==o.targetBlock)throw new Error("Gate 3 failed: invalid target block");
 await simulatePrivate({from:o.from,to:o.target,data:o.calldata});
 const raw=process.env.AEGIS_SIGNED_RAW_TRANSACTION;if(!raw)throw new Error("Gate 4 failed: signed transaction missing");
 return submitPrivate(raw,o.targetBlock);
}