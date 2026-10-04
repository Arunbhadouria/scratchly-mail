import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const workerConfig = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  CAMPAIGN_SENDING_MODE: (process.env.CAMPAIGN_SENDING_MODE || 'dry-run') as 'dry-run' | 'ses',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || 'outreach@scratchlymail.local',
  AWS_SES_CONFIGURATION_SET: process.env.AWS_SES_CONFIGURATION_SET || '',

  QUEUE_POLL_INTERVAL_MS: Number(process.env.QUEUE_POLL_INTERVAL_MS) || 2000,
  QUEUE_BATCH_SIZE: Number(process.env.QUEUE_BATCH_SIZE) || 50,
  QUEUE_LOCK_TIMEOUT_SEC: Number(process.env.QUEUE_LOCK_TIMEOUT_SEC) || 120,
};
