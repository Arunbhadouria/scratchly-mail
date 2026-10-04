import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { GmailService } from '../services/gmail.service.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { RegisterSchema, LoginSchema } from '@scratchly/shared';
import { env } from '../config/env.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await AuthService.getProfile(req.user!.id, req.user!.tenantId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// Google OAuth 2.0 Redirect Callback Handler
authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${env.WEB_URL}/?tab=connections&error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ success: false, error: 'Missing OAuth code or state parameter' });
      return;
    }

    await GmailService.handleOAuthCallback(String(code), String(state));
    res.redirect(`${env.WEB_URL}/?tab=connections&connected=true`);
  } catch (err: any) {
    console.error('[Google OAuth Callback Error]:', err.message);
    res.redirect(`${env.WEB_URL}/?tab=connections&error=${encodeURIComponent(err.message || 'OAuth connection failed')}`);
  }
});
