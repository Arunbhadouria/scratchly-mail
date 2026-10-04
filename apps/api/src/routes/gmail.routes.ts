import { Router } from 'express';
import { GmailService } from '../services/gmail.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  SendGmailMessageSchema,
  CreateGmailDraftSchema,
  ReplyGmailMessageSchema,
} from '@scratchly/shared';
import { env } from '../config/env.js';

export const gmailRouter = Router();

// =============================================================================
// OAuth Flow
// =============================================================================

/**
 * Initiates the Google OAuth 2.0 flow.
 * Returns authorization URL for single-page applications or redirects if requested.
 */
gmailRouter.get('/connect', requireAuth, (req, res, next) => {
  try {
    const url = GmailService.getAuthorizationUrl(req.user!.tenantId, req.user!.id);
    if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
      res.json({ success: true, data: { url, authUrl: url } });
    } else {
      res.redirect(url);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * Google OAuth 2.0 Redirect Callback.
 * Validates CSRF/tenant state, exchanges auth code for tokens, and redirects back to web app.
 */
gmailRouter.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${env.WEB_URL}/?tab=connections&error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${env.WEB_URL}/?tab=connections&error=${encodeURIComponent('Missing OAuth code or state parameter')}`);
      return;
    }

    await GmailService.handleOAuthCallback(String(code), String(state));
    res.redirect(`${env.WEB_URL}/?tab=connections&connected=true`);
  } catch (err: any) {
    res.redirect(`${env.WEB_URL}/?tab=connections&error=${encodeURIComponent(err.message || 'OAuth authorization failed')}`);
  }
});

/**
 * Returns connection and configuration status for the current user and tenant.
 */
gmailRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const status = await GmailService.getConnectionStatus(req.user!.tenantId, req.user!.id);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * Disconnects the user's Gmail connection and clears credentials.
 */
gmailRouter.post('/disconnect', requireAuth, async (req, res, next) => {
  try {
    const result = await GmailService.disconnect(req.user!.tenantId, undefined, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// Mailbox & Message Operations (Requires Authentication & Connected Account)
// =============================================================================

/**
 * Lists recent messages from the connected Gmail account with contact matching.
 */
gmailRouter.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const maxResults = req.query.maxResults ? parseInt(String(req.query.maxResults), 10) : 20;
    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;

    const result = await GmailService.listMessages(req.user!.tenantId, req.user!.id, {
      maxResults,
      pageToken,
      q,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Retrieves a single Gmail message with sanitized HTML body, plain text, and sender contact match.
 */
gmailRouter.get('/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const message = await GmailService.getMessage(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});

/**
 * Retrieves an entire thread with all chronological messages and participant contact matches.
 */
gmailRouter.get('/threads/:id', requireAuth, async (req, res, next) => {
  try {
    const thread = await GmailService.getThread(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: thread });
  } catch (err) {
    next(err);
  }
});

/**
 * Creates a Gmail draft (without sending).
 */
gmailRouter.post('/drafts', requireAuth, validateBody(CreateGmailDraftSchema), async (req, res, next) => {
  try {
    const result = await GmailService.createDraft(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Sends an individual email via Gmail (explicit user action).
 */
gmailRouter.post('/send', requireAuth, validateBody(SendGmailMessageSchema), async (req, res, next) => {
  try {
    const result = await GmailService.sendIndividualEmail(req.user!.tenantId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Replies to an existing Gmail thread preserving threading headers (In-Reply-To, References, threadId).
 */
gmailRouter.post('/reply', requireAuth, validateBody(ReplyGmailMessageSchema), async (req, res, next) => {
  try {
    const result = await GmailService.replyToThread(req.user!.tenantId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
