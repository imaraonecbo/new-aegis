import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Security & Authentication Secrets
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for HMAC-SHA256').default('aegis-quant-production-super-secret-jwt-key-982347109238'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(15),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(15),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  
  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/aegis_quant_db'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  
  // CORS & Security Headers
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  ENABLE_HELMET_HSTS: z.enum(['true', 'false']).default('true'),
  
  // Risk & Trading Parameter Limits
  MAX_POSITION_EXPOSURE_PCT: z.coerce.number().default(30.0),
  MAX_LTV_CEILING_PCT: z.coerce.number().default(78.0),
  MIN_HEALTH_FACTOR_FLOOR: z.coerce.number().default(1.15),
  MAX_DAILY_DRAWDOWN_LIMIT_USD: z.coerce.number().default(10000),
  
  // RPC Endpoints
  ARBITRUM_RPC_URL: z.string().url().default('https://arb1.arbitrum.io/rpc'),
  SEPOLIA_RPC_URL: z.string().url().default('https://rpc.sepolia.org'),
  
  // Sentry / Telemetry
  SENTRY_DSN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadAndValidateConfig(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    const errorDetails = parsed.error.format();
    console.error('❌ [FATAL] Environment Configuration Validation Failed:', JSON.stringify(errorDetails, null, 2));
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Critical environment variables missing or invalid: ${JSON.stringify(errorDetails)}`);
    }
  }
  
  return parsed.data || (envSchema.parse({}) as EnvConfig);
}

export const config = loadAndValidateConfig();
