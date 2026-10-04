import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { prisma } from './lib/db.js';
import { errorHandler } from './middleware/errorHandler.js';

import { authRouter } from './routes/auth.routes.js';
import { contactRouter } from './routes/contact.routes.js';
import { templateRouter } from './routes/template.routes.js';
import { campaignRouter } from './routes/campaign.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { gmailRouter } from './routes/gmail.routes.js';

export const app = express();

// Security & Parsing Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Permissive for local dashboard dev
}));

const allowedOrigins = [
  env.WEB_URL?.replace(/\/+$/, ''),
  'https://scratchly-mail.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (e: any) {
    dbStatus = `error: ${e.message}`;
  }

  res.json({
    status: 'ok',
    service: 'scratchly-mail-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    campaignSendingMode: env.CAMPAIGN_SENDING_MODE,
  });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/templates', templateRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/integrations/gmail', gmailRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central Error Handler
app.use(errorHandler);
