import { z } from "zod";

const b = z.enum(["true", "false"]).transform(v => v === "true");
const hexKey = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  ENGINE_ENABLED: b.default("false"),
  ENGINE_DRY_RUN: b.default("true"),
  CHAIN_ID: z.coerce.number().int().default(42161),
  ARBITRUM_RPC_URL: z.string().url(),
  ARBITRUM_SIMULATION_RPC_URL: z.string().url(),
  ARBITRUM_PRIVATE_RPC_URL: z.string().url(),
  EXECUTOR_ADDRESS: address,
  EXECUTOR_PRIVATE_KEY: hexKey.optional(),
  EXECUTION_SIGNER_PRIVATE_KEY: hexKey,
  TARGET_BLOCK_OFFSET: z.coerce.number().int().min(1).max(1).default(1),
  PRIVATE_SUBMISSION_REQUIRED: b.default("true"),
  SIMULATION_ENDPOINT_ATTESTED: b.default("false"),
  PRIVATE_SUBMISSION_ATTESTED: b.default("false"),
  PRIVATE_RPC_METHOD: z.string().default("eth_sendRawTransaction"),
  MIN_PROFIT_USD: z.coerce.number().positive().default(5),
  MIN_PROFIT_BPS: z.coerce.number().nonnegative().default(20),
  RELAYER_FEE_CAP_BPS: z.coerce.number().nonnegative().default(5),
  SIMULATION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  MAX_TRADE_USD: z.coerce.number().positive().default(1000),
  AA_ENABLED: b.default("false"),
  ALCHEMY_API_KEY: z.string().min(1).optional(),
  ALCHEMY_POLICY_ID: z.string().min(1).optional(),
  AA_OWNER_PRIVATE_KEY: hexKey.optional(),
  AA_ACCOUNT_ADDRESS: address.optional(),
  AA_GAS_TOKEN_ADDRESS: address.optional(),
  AA_MAX_GAS_TOKEN_AMOUNT: z.coerce.bigint().positive().optional(),
  AA_MAX_FEE_PER_GAS_WEI: z.coerce.bigint().positive().optional(),
  AEGIS_PANIC_FILE: z.string().default("runtime/aegis.panic"),
  SENTRY_DSN: z.string().url().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional()
}).superRefine((v, c) => {
  if (v.CHAIN_ID !== 42161) c.addIssue({ code: "custom", path: ["CHAIN_ID"], message: "Arbitrum One only" });
  if (v.ENGINE_ENABLED && v.ENGINE_DRY_RUN) c.addIssue({ code: "custom", path: ["ENGINE_DRY_RUN"], message: "Live engine cannot be dry-run" });
  if (v.ENGINE_ENABLED && !v.SIMULATION_ENDPOINT_ATTESTED) c.addIssue({ code: "custom", path: ["SIMULATION_ENDPOINT_ATTESTED"], message: "Dedicated private simulation endpoint must be attested" });

  if (v.ENGINE_ENABLED && v.AA_ENABLED) {
    if (!v.ALCHEMY_API_KEY) c.addIssue({ code: "custom", path: ["ALCHEMY_API_KEY"], message: "Alchemy API key required for AA" });
    if (!v.ALCHEMY_POLICY_ID) c.addIssue({ code: "custom", path: ["ALCHEMY_POLICY_ID"], message: "Alchemy paymaster policy required for AA" });
    if (!v.AA_OWNER_PRIVATE_KEY) c.addIssue({ code: "custom", path: ["AA_OWNER_PRIVATE_KEY"], message: "AA owner key required for AA" });
    if (!v.AA_GAS_TOKEN_ADDRESS) c.addIssue({ code: "custom", path: ["AA_GAS_TOKEN_ADDRESS"], message: "AA gas token required for AA" });
    if (!v.AA_MAX_GAS_TOKEN_AMOUNT) c.addIssue({ code: "custom", path: ["AA_MAX_GAS_TOKEN_AMOUNT"], message: "AA gas token cap required for AA" });
    if (!v.AA_MAX_FEE_PER_GAS_WEI) c.addIssue({ code: "custom", path: ["AA_MAX_FEE_PER_GAS_WEI"], message: "AA max fee-per-gas cap required for AA" });
  } else if (v.ENGINE_ENABLED) {
    if (!v.EXECUTOR_PRIVATE_KEY) c.addIssue({ code: "custom", path: ["EXECUTOR_PRIVATE_KEY"], message: "Executor private key required when AA is disabled" });
    if (!v.PRIVATE_SUBMISSION_REQUIRED) c.addIssue({ code: "custom", path: ["PRIVATE_SUBMISSION_REQUIRED"], message: "Private submission is mandatory" });
    if (!v.PRIVATE_SUBMISSION_ATTESTED) c.addIssue({ code: "custom", path: ["PRIVATE_SUBMISSION_ATTESTED"], message: "Private submission endpoint must be attested" });
  }
});

export type Env = z.infer<typeof schema>;
export const env = schema.parse(process.env);