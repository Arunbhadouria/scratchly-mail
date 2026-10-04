import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { generateOAuthState, verifyOAuthState, encryptToken } from '../src/lib/crypto.js';
import { GmailService } from '../src/services/gmail.service.js';

describe('Phase 4 — Gmail OAuth 2.0 & Mailbox Integration Tests', () => {
  let authTokenA: string;
  let tenantIdA: string;
  let userIdA: string;

  let authTokenB: string;
  let tenantIdB: string;
  let userIdB: string;

  beforeAll(async () => {
    // 1. Authenticate with Tenant A
    const resA = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@scratchly.local',
        password: 'ScratchlyAdmin123!',
      });

    expect(resA.status).toBe(200);
    authTokenA = resA.body.data.token;
    tenantIdA = resA.body.data.user.tenantId;
    userIdA = resA.body.data.user.id;

    // 2. Register Tenant B for cross-tenant isolation testing
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Gamma Tester',
        email: `gamma.${Date.now()}@isolategmail.local`,
        password: 'Password123!',
        tenantName: 'Gamma Workspace',
      });

    expect(resB.status).toBe(201);
    authTokenB = resB.body.data.token;
    tenantIdB = resB.body.data.user.tenantId;
    userIdB = resB.body.data.user.id;
  });

  // ===========================================================================
  // 1. OAuth State Generation, HMAC Validation, Expiration & Anti-CSRF
  // ===========================================================================
  describe('OAuth State CSRF Protection & HMAC Signing', () => {
    it('should generate a signed OAuth state containing tenantId and userId', () => {
      const state = generateOAuthState(tenantIdA, userIdA);
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(20);

      const parsed = verifyOAuthState(state);
      expect(parsed.tenantId).toBe(tenantIdA);
      expect(parsed.userId).toBe(userIdA);
    });

    it('should reject tampered state payloads where data was altered', () => {
      const state = generateOAuthState(tenantIdA, userIdA);
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));

      // Tamper with payload
      decoded.data = JSON.stringify({ tenantId: tenantIdB, userId: userIdB, timestamp: Date.now() });
      const tamperedState = Buffer.from(JSON.stringify(decoded)).toString('base64url');

      expect(() => verifyOAuthState(tamperedState)).toThrow(/Invalid OAuth state signature/i);
    });

    it('should reject forged state where signature is fabricated', () => {
      const fakeState = Buffer.from(
        JSON.stringify({
          data: JSON.stringify({ tenantId: tenantIdA, userId: userIdA, timestamp: Date.now() }),
          signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        })
      ).toString('base64url');

      expect(() => verifyOAuthState(fakeState)).toThrow(/Invalid OAuth state signature/i);
    });

    it('should enforce state expiration (>15 minutes old)', () => {
      // Craft an expired state 20 minutes in the past
      const twentyMinsAgo = Date.now() - 20 * 60 * 1000;
      const crypto = require('crypto');
      const dataStr = JSON.stringify({
        tenantId: tenantIdA,
        userId: userIdA,
        nonce: 'test-expired-nonce',
        timestamp: twentyMinsAgo,
      });
      const signature = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'scratchly_mail_local_dev_jwt_secret_key_super_secure_32_chars_min')
        .update(dataStr)
        .digest('hex');

      const expiredState = Buffer.from(JSON.stringify({ data: dataStr, signature })).toString('base64url');

      expect(() => verifyOAuthState(expiredState)).toThrow(/expired/i);
    });
  });

  // ===========================================================================
  // 2. OAuth API Endpoints & Authorization Flow
  // ===========================================================================
  describe('OAuth API Endpoints & Route Security', () => {
    it('should require authentication for /api/integrations/gmail/connect', async () => {
      const res = await request(app).get('/api/integrations/gmail/connect');
      expect(res.status).toBe(401);
    });

    it('should return valid authorization URL when authenticated', async () => {
      const res = await request(app)
        .get('/api/integrations/gmail/connect?format=json')
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.body.data.url).toContain('response_type=code');
      expect(res.body.data.url).toContain('access_type=offline');
      expect(res.body.data.url).toContain('prompt=consent');
      expect(res.body.data.url).toContain('state=');
    });

    it('should redirect with error when callback receives an error query param', async () => {
      const res = await request(app).get('/api/integrations/gmail/callback?error=access_denied');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('error=access_denied');
    });

    it('should reject callback if code or state parameter is missing', async () => {
      const res = await request(app).get('/api/integrations/gmail/callback');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('error=Missing%20OAuth%20code');
    });

    it('should reject callback if state parameter is invalid or tampered', async () => {
      const res = await request(app).get('/api/integrations/gmail/callback?code=fake_code&state=invalid_tampered_state');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('error=');
    });
  });

  // ===========================================================================
  // 3. Gmail Connection Status & Tenant Isolation
  // ===========================================================================
  describe('Gmail Connection Status & Tenant Isolation', () => {
    const testGmailAddress = `personal.${Date.now()}@gmail.com`;

    it('should require authentication for /api/integrations/gmail/status', async () => {
      const res = await request(app).get('/api/integrations/gmail/status');
      expect(res.status).toBe(401);
    });

    it('should report not connected when no connection exists', async () => {
      const res = await request(app)
        .get('/api/integrations/gmail/status')
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(false);
      expect(res.body.data.connection).toBeNull();
    });

    it('should store encrypted tokens at rest and report connected status for the owner tenant only', async () => {
      // Seed a connection for Tenant A
      const encAccess = encryptToken('mock-access-token-12345');
      const encRefresh = encryptToken('mock-refresh-token-67890');

      const connection = await prisma.emailConnection.create({
        data: {
          tenantId: tenantIdA,
          userId: userIdA,
          provider: 'GMAIL',
          emailAddress: testGmailAddress,
          encryptedAccessToken: encAccess,
          encryptedRefreshToken: encRefresh,
          scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
          status: 'CONNECTED',
        },
      });

      expect(connection.id).toBeDefined();

      // Check Tenant A status
      const resA = await request(app)
        .get('/api/integrations/gmail/status')
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.connected).toBe(true);
      expect(resA.body.data.connection.emailAddress).toBe(testGmailAddress);
      expect(resA.body.data.connection.status).toBe('CONNECTED');

      // Crucial Security Verification: Never expose tokens in API response
      expect(resA.body.data.connection.encryptedAccessToken).toBeUndefined();
      expect(resA.body.data.connection.encryptedRefreshToken).toBeUndefined();
      expect(resA.body.data.connection.accessToken).toBeUndefined();
      expect(resA.body.data.connection.refreshToken).toBeUndefined();

      // Cross-Tenant Isolation: Tenant B must NOT see Tenant A's connection
      const resB = await request(app)
        .get('/api/integrations/gmail/status')
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.connected).toBe(false);
      expect(resB.body.data.connection).toBeNull();
    });
  });

  // ===========================================================================
  // 4. Disconnect & Security Hygiene
  // ===========================================================================
  describe('Gmail Disconnect & Token Invalidation', () => {
    it('should disconnect an active connection and clear stored encrypted tokens', async () => {
      const res = await request(app)
        .post('/api/integrations/gmail/disconnect')
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify database record has cleared tokens
      const dbConn = await prisma.emailConnection.findFirst({
        where: { tenantId: tenantIdA, provider: 'GMAIL' },
        orderBy: { createdAt: 'desc' },
      });

      expect(dbConn?.status).toBe('DISCONNECTED');
      expect(dbConn?.encryptedAccessToken).toBe('');
      expect(dbConn?.encryptedRefreshToken).toBeNull();

      // Verify Audit Log entry was recorded without tokens
      const auditLog = await prisma.auditLog.findFirst({
        where: { tenantId: tenantIdA, action: 'GMAIL_DISCONNECTED' },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(JSON.stringify(auditLog?.details)).not.toContain('mock-');
    });

    it('should return 404 GMAIL_NOT_CONNECTED when disconnecting without an existing connection', async () => {
      const res = await request(app)
        .post('/api/integrations/gmail/disconnect')
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('GMAIL_NOT_CONNECTED');
    });
  });

  // ===========================================================================
  // 5. Contact Matching with Gmail Senders
  // ===========================================================================
  describe('Gmail Sender → CRM Contact Matching', () => {
    const senderEmail = `contact.match.${Date.now()}@enterprise.com`;

    beforeAll(async () => {
      // Create contact in Tenant A
      await prisma.contact.create({
        data: {
          tenantId: tenantIdA,
          email: senderEmail,
          firstName: 'Marcus',
          lastName: 'Vance',
          company: 'Vance Refrigeration',
          phone: '+1 555-8822',
        },
      });
    });

    it('should extract email address from RFC sender header formats', () => {
      expect(GmailService.extractEmailAddress('Marcus Vance <marcus@enterprise.com>')).toBe('marcus@enterprise.com');
      expect(GmailService.extractEmailAddress('"Vance, Marcus" <marcus@enterprise.com>')).toBe('marcus@enterprise.com');
      expect(GmailService.extractEmailAddress('marcus@enterprise.com')).toBe('marcus@enterprise.com');
      expect(GmailService.extractEmailAddress('')).toBe('');
    });

    it('should match a known sender to their local CRM Contact record in Tenant A', async () => {
      const match = await GmailService.matchContact(tenantIdA, senderEmail);
      expect(match.found).toBe(true);
      expect(match.contact?.firstName).toBe('Marcus');
      expect(match.contact?.lastName).toBe('Vance');
      expect(match.contact?.company).toBe('Vance Refrigeration');
    });

    it('should return found: false for an unknown sender email', async () => {
      const match = await GmailService.matchContact(tenantIdA, 'unknown.person@nowhere.org');
      expect(match.found).toBe(false);
      expect(match.contact).toBeUndefined();
    });

    it('should enforce tenant isolation for contact matching (Tenant B cannot match Tenant A contacts)', async () => {
      const matchB = await GmailService.matchContact(tenantIdB, senderEmail);
      expect(matchB.found).toBe(false);
    });
  });

  // ===========================================================================
  // 6. Request Validation for Send, Reply, and Drafts
  // ===========================================================================
  describe('Gmail API Request Validation', () => {
    it('should reject individual send without required recipient email', async () => {
      const res = await request(app)
        .post('/api/integrations/gmail/send')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          subject: 'Test Subject',
          bodyHtml: '<p>Hello</p>',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject individual send without required subject', async () => {
      const res = await request(app)
        .post('/api/integrations/gmail/send')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          to: 'client@example.com',
          subject: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject thread reply without threadId', async () => {
      const res = await request(app)
        .post('/api/integrations/gmail/reply')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          to: 'client@example.com',
          subject: 'Re: Test',
          bodyHtml: '<p>Response</p>',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject operations on unconnected tenant with 404 GMAIL_NOT_CONNECTED', async () => {
      const res = await request(app)
        .get('/api/integrations/gmail/messages')
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('GMAIL_NOT_CONNECTED');
    });
  });

  // ===========================================================================
  // 7. Token Failure & Re-authentication State
  // ===========================================================================
  describe('Token Refresh Failure & REAUTH_REQUIRED Handling', () => {
    it('should reject requests with 401 GMAIL_REAUTH_REQUIRED when connection status is REAUTH_REQUIRED', async () => {
      // Create connection with REAUTH_REQUIRED status
      await prisma.emailConnection.create({
        data: {
          tenantId: tenantIdB,
          userId: userIdB,
          provider: 'GMAIL',
          emailAddress: `expired.${Date.now()}@gmail.com`,
          encryptedAccessToken: encryptToken('expired-access-token'),
          encryptedRefreshToken: encryptToken('revoked-refresh-token'),
          status: 'REAUTH_REQUIRED',
        },
      });

      const res = await request(app)
        .get('/api/integrations/gmail/messages')
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('GMAIL_REAUTH_REQUIRED');
      expect(res.body.error).toContain('reconnect');
    });
  });
});
