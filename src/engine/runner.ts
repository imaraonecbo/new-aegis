import {simulatePrivate} from "../simulators/ethSimulate";
import {submitPrivate} from "../mev/relayerRouter";
import {assertExecutionSigner,ExecutionIntent} from "../crypto/signer";
import {env} from "../config/env";
import {executeGaslessCall} from "../aa/gaslessExecution";

export type FiveGateOpportunity={
 from:string;
 to:string;
 calldata:string;
 rawTransaction:string;
 targetBlock:number;
 netProfitUsd:number;
 minProfitUsd:number;
 intent:ExecutionIntent;
 signature:string;
 expectedSigner:string
};

export async function executeFiveGates(o:FiveGateOpportunity){
 if(!env.ENGINE_ENABLED||env.ENGINE_DRY_RUN)throw new Error("GATE_0: engine disabled or dry-run");
 if(o.netProfitUsd<Math.max(env.MIN_PROFIT_USD,o.minProfitUsd))throw new Error("GATE_1: profitability failed");
 if(o.targetBlock<=0||o.targetBlock!==Number(o.intent.targetBlock))throw new Error("GATE_2: target block binding failed");
 assertExecutionSigner(o.intent,o.signature,o.expectedSigner);

 if(env.AA_ENABLED){
   if(o.intent.feeRecipient.toLowerCase()!==o.intent.relayer.toLowerCase())throw new Error("GATE_AA: fee recipient must equal AA relayer");
   return executeGaslessCall({
     to:o.to,
     data:o.calldata,
     netProfitUsd:o.netProfitUsd,
     expectedRelayer:o.intent.relayer
   });
 }

 await simulatePrivate({from:o.from,to:o.to,data:o.calldata});
 if(!o.rawTransaction)throw new Error("GATE_4: signed raw transaction missing");
 if(!env.PRIVATE_SUBMISSION_REQUIRED)throw new Error("GATE_5: private submission disabled");
 return submitPrivate(o.rawTransaction,o.targetBlock);
}
