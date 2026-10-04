import { google } from 'googleapis';
import { prisma } from '../lib/db.js';
import { env } from '../config/env.js';
import { encryptToken, decryptToken, generateOAuthState, verifyOAuthState } from '../lib/crypto.js';
import {
  SendGmailMessageInput,
  CreateGmailDraftInput,
  ReplyGmailMessageInput,
  sanitizeHtmlContent,
} from '@scratchly/shared';

// Enforce native fetch on googleapis to avoid node-fetch premature stream close issues in Node 22+
google.options({ fetchImplementation: fetch });

export interface ContactMatchInfo {
  found: boolean;
  contact?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string;
    phone: string | null;
    status: string;
  };
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  contactMatch: ContactMatchInfo;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyHtml: string;
  bodyText: string;
  messageIdHeader?: string;
  inReplyToHeader?: string;
  referencesHeader?: string;
}

export interface GmailThreadDetail {
  id: string;
  messages: GmailMessageDetail[];
  participants: Array<{ email: string; name: string; contactMatch: ContactMatchInfo }>;
}

export class GmailService {
  /**
   * Checks whether Google OAuth application credentials are configured in the environment.
   */
  static isConfigured(): boolean {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    return !!(
      clientId &&
      clientSecret &&
      clientId.length > 5 &&
      clientSecret.length > 5 &&
      !clientId.startsWith('mock-') &&
      !clientSecret.startsWith('mock-')
    );
  }

  /**
   * Initializes OAuth2 client configured with environment variables and native fetch.
   */
  public static getOAuth2Client() {
    const client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    if ((client as any).transporter?.instance?.defaults) {
      (client as any).transporter.instance.defaults.fetchImplementation = fetch;
    }

    return client;
  }

  /**
   * Helper to parse sender address (e.g. "Jane Doe <jane@example.com>" -> "jane@example.com").
   */
  static extractEmailAddress(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/<([^>]+)>/);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }
    return raw.replace(/["']/g, '').toLowerCase().trim();
  }

  /**
   * Helper to extract display name from header.
   */
  static extractDisplayName(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/^"?([^"<]+)"?\s*<.+>$/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return raw.split('@')[0] || raw;
  }

  /**
   * Looks up a contact by email within the tenant.
   */
  static async matchContact(tenantId: string, email: string): Promise<ContactMatchInfo> {
    if (!email) return { found: false };
    const contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        email: { equals: email.toLowerCase().trim(), mode: 'insensitive' },
      },
    });

    if (!contact) {
      return { found: false };
    }

    return {
      found: true,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
      },
    };
  }

  /**
   * Generates authorization URL with signed state binding tenant & user.
   */
  static getAuthorizationUrl(tenantId: string, userId: string): string {
    if (!this.isConfigured()) {
      throw {
        status: 503,
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'Google OAuth integration is not configured. Please supply GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      };
    }

    const oauth2Client = this.getOAuth2Client();
    const state = generateOAuthState(tenantId, userId);
    const scopes = env.GOOGLE_OAUTH_SCOPES.split(',');

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });
  }

  /**
   * Exchanges OAuth code for tokens, verifies profile, and stores encrypted credentials at rest.
   */
  static async handleOAuthCallback(code: string, state: string) {
    const { tenantId, userId } = verifyOAuthState(state);
    const oauth2Client = this.getOAuth2Client();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      const emailAddress = userInfo.data.email;

      if (!emailAddress) {
        throw new Error('Unable to retrieve email address from Google OAuth profile');
      }

      const encryptedAccess = encryptToken(tokens.access_token || '');
      const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;
      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

      const connection = await prisma.emailConnection.upsert({
        where: {
          tenantId_emailAddress: {
            tenantId,
            emailAddress,
          },
        },
        update: {
          userId,
          encryptedAccessToken: encryptedAccess,
          ...(encryptedRefresh && { encryptedRefreshToken: encryptedRefresh }),
          tokenExpiresAt: expiresAt,
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
        create: {
          tenantId,
          userId,
          provider: 'GMAIL',
          emailAddress,
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          tokenExpiresAt: expiresAt,
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          status: 'CONNECTED',
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GMAIL_CONNECTED',
          entityType: 'EmailConnection',
          entityId: connection.id,
          details: { emailAddress, provider: 'GMAIL' },
        },
      });

      return { connection, emailAddress };
    } catch (err: any) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GMAIL_CONNECTION_FAILED',
          entityType: 'EmailConnection',
          details: { error: err.message },
        },
      }).catch(() => {});

      throw err;
    }
  }

  /**
   * Retrieves connection status and health for the tenant & user.
   */
  static async getConnectionStatus(tenantId: string, userId?: string) {
    const isConfig = this.isConfigured();

    const connection = await prisma.emailConnection.findFirst({
      where: {
        tenantId,
        provider: 'GMAIL',
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      configured: isConfig,
      connected: !!connection && connection.status === 'CONNECTED',
      status: connection?.status || 'DISCONNECTED',
      connection: connection
        ? {
            id: connection.id,
            emailAddress: connection.emailAddress,
            status: connection.status,
            scopes: connection.scopes,
            connectedBy: connection.user.name || connection.user.email,
            lastSyncAt: connection.lastSyncAt,
            createdAt: connection.createdAt,
          }
        : null,
    };
  }

  /**
   * Disconnects a Gmail connection, attempts Google token revocation, and clears stored secrets.
   */
  static async disconnect(tenantId: string, connectionId?: string, userId?: string) {
    const whereClause: any = { tenantId, provider: 'GMAIL' };
    if (connectionId) {
      whereClause.id = connectionId;
    } else if (userId) {
      whereClause.userId = userId;
    }

    const connection = await prisma.emailConnection.findFirst({ where: whereClause, orderBy: { createdAt: 'desc' } });
    if (!connection) {
      throw { status: 404, code: 'GMAIL_NOT_CONNECTED', message: 'Email connection not found' };
    }

    // Attempt token revocation with Google (swallow errors if already revoked)
    if (connection.encryptedRefreshToken) {
      try {
        const refreshToken = decryptToken(connection.encryptedRefreshToken);
        const oauth2Client = this.getOAuth2Client();
        await oauth2Client.revokeToken(refreshToken);
      } catch (e) {
        // Safe to ignore if revocation endpoint fails
      }
    }

    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        encryptedAccessToken: '',
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || connection.userId,
        action: 'GMAIL_DISCONNECTED',
        entityType: 'EmailConnection',
        entityId: connection.id,
        details: { emailAddress: connection.emailAddress },
      },
    });

    return { success: true };
  }

  /**
   * Instantiates authenticated Gmail client with auto-refresh listeners and error trapping.
   */
  private static async getAuthenticatedGmailClient(tenantId: string, userId?: string, connectionId?: string) {
    const whereClause: any = { tenantId, provider: 'GMAIL' };
    if (connectionId) {
      whereClause.id = connectionId;
    } else if (userId) {
      whereClause.userId = userId;
    }

    const conn = await prisma.emailConnection.findFirst({ where: whereClause, orderBy: { createdAt: 'desc' } });
    if (!conn || conn.status === 'DISCONNECTED') {
      throw {
        status: 404,
        code: 'GMAIL_NOT_CONNECTED',
        message: 'No active Gmail connection found for this account. Please connect your Gmail account.',
      };
    }

    if (conn.status === 'REAUTH_REQUIRED' || conn.status === 'REVOKED') {
      throw {
        status: 401,
        code: 'GMAIL_REAUTH_REQUIRED',
        message: 'Gmail connection authorization expired or was revoked. Please reconnect your account.',
      };
    }

    const oauth2Client = this.getOAuth2Client();
    const accessToken = conn.encryptedAccessToken ? decryptToken(conn.encryptedAccessToken) : undefined;
    const refreshToken = conn.encryptedRefreshToken ? decryptToken(conn.encryptedRefreshToken) : undefined;

    if (!accessToken && !refreshToken) {
      throw {
        status: 401,
        code: 'GMAIL_REAUTH_REQUIRED',
        message: 'No credentials stored for this connection. Re-authentication required.',
      };
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-update database when Google refreshes the access token
    oauth2Client.on('tokens', async (newTokens) => {
      try {
        const updateData: any = {};
        if (newTokens.access_token) {
          updateData.encryptedAccessToken = encryptToken(newTokens.access_token);
        }
        if (newTokens.refresh_token) {
          updateData.encryptedRefreshToken = encryptToken(newTokens.refresh_token);
        }
        if (newTokens.expiry_date) {
          updateData.tokenExpiresAt = new Date(newTokens.expiry_date);
        }
        await prisma.emailConnection.update({
          where: { id: conn.id },
          data: updateData,
        });
      } catch {
        // Suppress background update error
      }
    });

    return {
      gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
      connection: conn,
      oauth2Client,
    };
  }

  /**
   * Catches and transforms Google API errors into consistent application errors.
   */
  private static async handleGoogleError(err: any, tenantId: string, connectionId?: string): Promise<never> {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || err?.status || 500;

    if (
      errMsg.includes('invalid_grant') ||
      errMsg.includes('Token has been expired or revoked') ||
      errCode === 401
    ) {
      if (connectionId) {
        await prisma.emailConnection.update({
          where: { id: connectionId },
          data: { status: 'REAUTH_REQUIRED' },
        }).catch(() => {});

        await prisma.auditLog.create({
          data: {
            tenantId,
            action: 'GMAIL_REAUTH_REQUIRED',
            entityType: 'EmailConnection',
            entityId: connectionId,
            details: { reason: 'invalid_grant' },
          },
        }).catch(() => {});
      }

      throw {
        status: 401,
        code: 'GMAIL_REAUTH_REQUIRED',
        message: 'Gmail authorization expired or was revoked. Please reconnect your account.',
      };
    }

    if (errCode === 403 || errMsg.includes('insufficientPermissions')) {
      throw {
        status: 403,
        code: 'GMAIL_PERMISSION_DENIED',
        message: 'Insufficient Gmail permissions or quota exceeded.',
      };
    }

    if (errCode === 429 || errMsg.includes('rateLimitExceeded')) {
      throw {
        status: 429,
        code: 'GMAIL_RATE_LIMITED',
        message: 'Gmail API rate limit exceeded. Please wait a few moments before retrying.',
      };
    }

    throw {
      status: errCode >= 400 && errCode < 600 ? errCode : 500,
      code: 'GMAIL_API_ERROR',
      message: errMsg || 'An error occurred during communication with Gmail.',
    };
  }

  /**
   * Lists recent messages from the user's Gmail inbox with local contact matching.
   */
  static async listMessages(
    tenantId: string,
    userId?: string,
    options: { maxResults?: number; pageToken?: string; q?: string; connectionId?: string } = {}
  ): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string }> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, options.connectionId);

    try {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: Math.min(options.maxResults || 20, 50),
        pageToken: options.pageToken,
        q: options.q,
      });

      const messageItems = listRes.data.messages || [];
      if (messageItems.length === 0) {
        return { messages: [] };
      }

      // Fetch metadata in parallel
      const detailedMessages = await Promise.all(
        messageItems.map(async (m) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: m.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            });

            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            const rawFrom = getHeader('From');
            const fromEmail = this.extractEmailAddress(rawFrom);
            const fromName = this.extractDisplayName(rawFrom);
            const contactMatch = await this.matchContact(tenantId, fromEmail);

            return {
              id: m.id!,
              threadId: m.threadId || detail.data.threadId || '',
              snippet: detail.data.snippet || '',
              from: rawFrom,
              fromEmail,
              fromName,
              to: getHeader('To'),
              subject: getHeader('Subject') || '(No Subject)',
              date: getHeader('Date') || '',
              contactMatch,
            };
          } catch {
            return null;
          }
        })
      );

      const validMessages = detailedMessages.filter((m): m is GmailMessageSummary => m !== null);

      return {
        messages: validMessages,
        nextPageToken: listRes.data.nextPageToken || undefined,
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }

  /**
   * Helper to recursively extract html and plain text from multipart Gmail message payload.
   */
  private static parseMessagePayload(payload: any): { html: string; text: string } {
    let html = '';
    let text = '';

    const decodeBase64Url = (str: string): string => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, 'base64').toString('utf-8');
    };

    const traverse = (part: any) => {
      if (!part) return;
      const mime = (part.mimeType || '').toLowerCase();

      if (part.body?.data) {
        const decoded = decodeBase64Url(part.body.data);
        if (mime === 'text/html' && !html) {
          html = decoded;
        } else if (mime === 'text/plain' && !text) {
          text = decoded;
        }
      }

      if (Array.isArray(part.parts)) {
        for (const sub of part.parts) {
          traverse(sub);
        }
      }
    };

    traverse(payload);
    return { html, text };
  }

  /**
   * Retrieves an individual message, safely parses multipart payload, and checks contact matching.
   */
  static async getMessage(
    tenantId: string,
    messageId: string,
    userId?: string,
    connectionId?: string
  ): Promise<GmailMessageDetail> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, connectionId);

    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = res.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const rawFrom = getHeader('From');
      const fromEmail = this.extractEmailAddress(rawFrom);
      const fromName = this.extractDisplayName(rawFrom);
      const contactMatch = await this.matchContact(tenantId, fromEmail);

      const { html, text } = this.parseMessagePayload(res.data.payload);

      return {
        id: res.data.id!,
        threadId: res.data.threadId || '',
        snippet: res.data.snippet || '',
        from: rawFrom,
        fromEmail,
        fromName,
        to: getHeader('To'),
        subject: getHeader('Subject') || '(No Subject)',
        date: getHeader('Date') || '',
        bodyHtml: html ? sanitizeHtmlContent(html) : '',
        bodyText: text || res.data.snippet || '',
        messageIdHeader: getHeader('Message-ID'),
        inReplyToHeader: getHeader('In-Reply-To'),
        referencesHeader: getHeader('References'),
        contactMatch,
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }

  /**
   * Retrieves an entire thread with all messages chronologically sorted and participants mapped to contacts.
   */
  static async getThread(
    tenantId: string,
    threadId: string,
    userId?: string,
    connectionId?: string
  ): Promise<GmailThreadDetail> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, connectionId);

    try {
      const res = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const rawMessages = res.data.messages || [];
      const messages: GmailMessageDetail[] = [];
      const participantsMap = new Map<string, { email: string; name: string; contactMatch: ContactMatchInfo }>();

      for (const m of rawMessages) {
        const headers = m.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const rawFrom = getHeader('From');
        const fromEmail = this.extractEmailAddress(rawFrom);
        const fromName = this.extractDisplayName(rawFrom);
        const contactMatch = await this.matchContact(tenantId, fromEmail);

        if (fromEmail && !participantsMap.has(fromEmail)) {
          participantsMap.set(fromEmail, { email: fromEmail, name: fromName, contactMatch });
        }

        const { html, text } = this.parseMessagePayload(m.payload);

        messages.push({
          id: m.id!,
          threadId: m.threadId || threadId,
          snippet: m.snippet || '',
          from: rawFrom,
          fromEmail,
          fromName,
          to: getHeader('To'),
          subject: getHeader('Subject') || '(No Subject)',
          date: getHeader('Date') || '',
          bodyHtml: html ? sanitizeHtmlContent(html) : '',
          bodyText: text || m.snippet || '',
          messageIdHeader: getHeader('Message-ID'),
          inReplyToHeader: getHeader('In-Reply-To'),
          referencesHeader: getHeader('References'),
          contactMatch,
        });
      }

      return {
        id: threadId,
        messages,
        participants: Array.from(participantsMap.values()),
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }

  /**
   * Creates a draft in Gmail.
   */
  static async createDraft(
    tenantId: string,
    userId: string,
    input: CreateGmailDraftInput,
    connectionId?: string
  ): Promise<{ success: boolean; draftId: string }> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, connectionId);

    try {
      const subject = input.subject || 'Draft';
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

      const lines: string[] = [];
      if (input.to) lines.push(`To: ${input.to}`);
      if (input.cc) lines.push(`Cc: ${input.cc}`);
      lines.push(`Subject: ${utf8Subject}`);
      lines.push('MIME-Version: 1.0');
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('');
      lines.push(input.bodyHtml || input.bodyText || '');

      const raw = Buffer.from(lines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const draftRes = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw,
            threadId: input.threadId,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GMAIL_DRAFT_CREATED',
          entityType: 'EmailConnection',
          entityId: connection.id,
          details: { to: input.to, subject, draftId: draftRes.data.id },
        },
      });

      return {
        success: true,
        draftId: draftRes.data.id!,
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }

  /**
   * Sends an individual email through the user's Gmail account (requires explicit user action).
   */
  static async sendIndividualEmail(
    tenantId: string,
    userId: string,
    input: SendGmailMessageInput,
    connectionId?: string
  ): Promise<{ success: boolean; messageId: string; threadId?: string }> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, connectionId);

    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(input.subject).toString('base64')}?=`;

      const lines = [
        `To: ${input.to}`,
        ...(input.cc ? [`Cc: ${input.cc}`] : []),
        ...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        input.bodyHtml || input.bodyText || '',
      ];

      const raw = Buffer.from(lines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GMAIL_MESSAGE_SENT',
          entityType: 'EmailConnection',
          entityId: connection.id,
          details: { to: input.to, subject: input.subject, messageId: res.data.id },
        },
      });

      return {
        success: true,
        messageId: res.data.id!,
        threadId: res.data.threadId || undefined,
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }

  /**
   * Replies to an existing thread preserving threading headers (In-Reply-To, References, threadId).
   */
  static async replyToThread(
    tenantId: string,
    userId: string,
    input: ReplyGmailMessageInput,
    connectionId?: string
  ): Promise<{ success: boolean; messageId: string; threadId: string }> {
    const { gmail, connection } = await this.getAuthenticatedGmailClient(tenantId, userId, connectionId);

    try {
      // Fetch thread to extract parent Message-ID header
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: input.threadId,
        format: 'metadata',
        metadataHeaders: ['Message-ID', 'Subject'],
      });

      const threadMessages = threadRes.data.messages || [];
      const parentMessage = threadMessages[threadMessages.length - 1];
      const parentHeaders = parentMessage?.payload?.headers || [];
      const parentMessageId = parentHeaders.find((h) => h.name?.toLowerCase() === 'message-id')?.value || '';

      const subject = input.subject.toLowerCase().startsWith('re:') ? input.subject : `Re: ${input.subject}`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

      const lines = [
        `To: ${input.to}`,
        `Subject: ${utf8Subject}`,
        ...(parentMessageId ? [`In-Reply-To: ${parentMessageId}`, `References: ${parentMessageId}`] : []),
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        input.bodyHtml || input.bodyText || '',
      ];

      const raw = Buffer.from(lines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
          threadId: input.threadId,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GMAIL_REPLY_SENT',
          entityType: 'EmailConnection',
          entityId: connection.id,
          details: { threadId: input.threadId, to: input.to, messageId: res.data.id },
        },
      });

      return {
        success: true,
        messageId: res.data.id!,
        threadId: input.threadId,
      };
    } catch (err: any) {
      return this.handleGoogleError(err, tenantId, connection.id);
    }
  }
}
