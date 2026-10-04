import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env or local .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),

  CAMPAIGN_SENDING_MODE: z.enum(['dry-run', 'ses']).default('dry-run'),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default('test-key'),
  AWS_SECRET_ACCESS_KEY: z.string().default('test-secret'),
  AWS_SES_FROM_EMAIL: z.string().email().default('outreach@scratchlymail.local'),
  AWS_SES_CONFIGURATION_SET: z.string().optional(),
  SES_WEBHOOK_SECRET: z.string().default('local-ses-secret'),

  GOOGLE_CLIENT_ID: z.string().default('mock-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('mock-google-client-secret'),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:4000/api/auth/google/callback'),
  GOOGLE_OAUTH_SCOPES: z.string().default('openid,email,profile,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.compose'),

  SCRATCHLY_CRM_ENABLED: z.coerce.boolean().default(false),
  SCRATCHLY_CRM_BASE_URL: z.string().optional(),
  SCRATCHLY_CRM_API_KEY: z.string().optional(),
  SCRATCHLY_CRM_WEBHOOK_SECRET: z.string().optional(),

  QUEUE_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  QUEUE_BATCH_SIZE: z.coerce.number().default(50),
  QUEUE_LOCK_TIMEOUT_SEC: z.coerce.number().default(120),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env = loadEnv();
