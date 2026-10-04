import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';

describe('Scratchly Mail REST API Endpoints', () => {
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    // Authenticate with seeded admin account
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@scratchly.local',
        password: 'ScratchlyAdmin123!',
      });

    if (res.status === 200 && res.body.data) {
      authToken = res.body.data.token;
      tenantId = res.body.data.user.tenantId;
    }
  });

  it('GET /health - should return healthy server and database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('scratchly-mail-api');
    expect(res.body.database).toBe('connected');
    expect(res.body.campaignSendingMode).toBeDefined();
  });

  it('POST /api/auth/login - should fail with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@scratchly.local',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/contacts - should require authentication', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(401);
  });

  it('GET /api/contacts - should return contacts with pagination for authenticated user', async () => {
    const res = await request(app)
      .get('/api/contacts?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('POST /api/contacts - should create a new valid contact with consent tracking', async () => {
    const randomEmail = `test.contact.${Date.now()}@example.org`;
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: randomEmail,
        firstName: 'Taylor',
        lastName: 'Swift',
        company: 'Swift Media Labs',
        consentGiven: true,
        consentProof: 'Verified API test creation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(randomEmail);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('POST /api/templates/preview/render - should render template preview with sample data', async () => {
    const res = await request(app)
      .post('/api/templates/preview/render')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subject: 'Hey {{first_name}} from {{company}}',
        bodyHtml: '<p>Hi {{first_name}}, check your email {{email}}</p>',
        sampleData: {
          first_name: 'Devin',
          company: 'Cognition',
          email: 'devin@example.com',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.subject).toBe('Hey Devin from Cognition');
    expect(res.body.data.html).toContain('Hi Devin, check your email devin@example.com');
  });

  it('GET /api/analytics/overview - should return real database metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contacts.total).toBeGreaterThan(0);
    expect(res.body.data.delivery).toBeDefined();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
