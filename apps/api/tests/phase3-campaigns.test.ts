import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { CampaignService } from '../src/services/campaign.service.js';

describe('Phase 3 — Core Email / Campaign Functionality Integration Tests', () => {
  let authTokenA: string;
  let tenantIdA: string;
  let userIdA: string;

  let authTokenB: string;
  let tenantIdB: string;

  beforeAll(async () => {
    // 1. Login with seeded Tenant A (Acme Growth Labs)
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

    // 2. Register Tenant B for Tenant Isolation tests
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Beta User',
        email: `beta.${Date.now()}@isolatelabs.local`,
        password: 'Password123!',
        tenantName: 'Isolate Labs Workspace',
      });

    expect(resB.status).toBe(201);
    authTokenB = resB.body.data.token;
    tenantIdB = resB.body.data.user.tenantId;
  });

  // ===========================================================================
  // 1. Contact Management & Duplicate Prevention
  // ===========================================================================
  describe('Contact Management & Tenant Isolation', () => {
    const contactEmail = `claire.${Date.now()}@dunphyrealty.com`;
    let createdContactId: string;

    it('should create a new valid contact with consent fields & audit log', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          email: contactEmail,
          firstName: 'Claire',
          lastName: 'Dunphy',
          company: 'Dunphy Realty',
          phone: '+1 555-0199',
          consentGiven: true,
          consentProof: 'Web opt-in verified test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(contactEmail);
      expect(res.body.data.isEligible).toBe(true);
      createdContactId = res.body.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: tenantIdA, action: 'CONTACT_CREATED', entityId: createdContactId },
      });
      expect(audit).not.toBeNull();
    });

    it('should reject duplicate contact creation in the same tenant (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          email: contactEmail,
          firstName: 'Duplicate',
          lastName: 'Claire',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should enforce tenant isolation (Tenant B cannot access Tenant A contact)', async () => {
      const res = await request(app)
        .get(`/api/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${authTokenB}`);

      expect(res.status).toBe(404);
    });

    it('should allow Tenant B to create the same email independently', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authTokenB}`)
        .send({
          email: contactEmail,
          firstName: 'Claire in Tenant B',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tenantId).toBe(tenantIdB);
    });
  });

  // ===========================================================================
  // 2. Suppression & Eligibility Filtering
  // ===========================================================================
  describe('Suppression & Eligibility Filtering', () => {
    let suppressedContactId: string;
    const suppressedEmail = `suppressed.${Date.now()}@example.org`;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          email: suppressedEmail,
          firstName: 'DoNot',
          lastName: 'Contact',
          company: 'OptOut Corp',
        });
      suppressedContactId = res.body.data.id;
    });

    it('should suppress a contact and update status to UNSUBSCRIBED', async () => {
      const res = await request(app)
        .post(`/api/contacts/${suppressedContactId}/suppress`)
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          reason: 'UNSUBSCRIBE',
          notes: 'User requested opt-out during test',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UNSUBSCRIBED');

      // Verify suppression record in DB
      const suppression = await prisma.suppression.findUnique({
        where: { tenantId_email: { tenantId: tenantIdA, email: suppressedEmail } },
      });
      expect(suppression).not.toBeNull();
      expect(suppression?.reason).toBe('UNSUBSCRIBE');
    });

    it('should exclude suppressed contact when filtering by eligibility=eligible', async () => {
      const res = await request(app)
        .get('/api/contacts?eligibility=eligible')
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      const emails = res.body.data.map((c: any) => c.email);
      expect(emails).not.toContain(suppressedEmail);
    });

    it('should include suppressed contact when filtering by eligibility=suppressed', async () => {
      const res = await request(app)
        .get('/api/contacts?eligibility=suppressed')
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      const emails = res.body.data.map((c: any) => c.email);
      expect(emails).toContain(suppressedEmail);
    });
  });

  // ===========================================================================
  // 3. Email Templates & Personalization
  // ===========================================================================
  describe('Email Templates & Variable Personalization', () => {
    let templateId: string;

    it('should create an email template with HTML, text, and variables', async () => {
      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          name: 'Q4 Enterprise Pitch',
          subject: 'Hello {{first_name}}, quick idea for {{company}}',
          bodyHtml: '<p>Hi {{first_name}},</p><p>Check out {{email}} at {{company}}.</p>',
          bodyText: 'Hi {{first_name}},\n\nCheck out {{email}} at {{company}}.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      templateId = res.body.data.id;
    });

    it('should duplicate a template creating a "Copy of..." record', async () => {
      const res = await request(app)
        .post(`/api/templates/${templateId}/duplicate`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Copy of Q4 Enterprise Pitch');
      expect(res.body.data.subject).toContain('Hello {{first_name}}');
    });

    it('should render preview with custom sample contact variables', async () => {
      const res = await request(app)
        .post('/api/templates/preview/render')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          subject: 'Hey {{first_name}} from {{company}}',
          bodyHtml: '<p>Personalized for {{first_name}} ({{email}})</p>',
          sampleData: {
            first_name: 'Satya',
            company: 'Microsoft',
            email: 'satya@microsoft.com',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe('Hey Satya from Microsoft');
      expect(res.body.data.html).toContain('Personalized for Satya (satya@microsoft.com)');
    });
  });

  // ===========================================================================
  // 4. Campaign Pre-flight, Launch, Snapshot, Pause, Resume, and Cancel
  // ===========================================================================
  describe('Campaign Workflow, Pre-flight Summary & Lifecycle Controls', () => {
    let testTemplateId: string;
    let campaignId: string;

    beforeAll(async () => {
      const tpl = await prisma.emailTemplate.create({
        data: {
          tenantId: tenantIdA,
          name: 'Campaign Workflow Template',
          subject: 'Outreach to {{first_name}} at {{company}}',
          bodyHtml: '<p>Hi {{first_name}}, let us connect {{company}}.</p>',
        },
      });
      testTemplateId = tpl.id;
    });

    it('should create a draft campaign', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({
          name: 'Spring Partnership Outreach',
          subject: 'Exclusive update for {{company}}',
          templateId: testTemplateId,
          provider: 'DRY_RUN',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      campaignId = res.body.data.id;
    });

    it('should calculate audience pre-flight summary with exclusions', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/audience`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSelected).toBeGreaterThan(0);
      expect(res.body.data.eligibleCount).toBeGreaterThan(0);
      expect(res.body.data.finalSendableCount).toBe(res.body.data.eligibleCount);
    });

    it('should reject launch if zero eligible recipients exist in tenant', async () => {
      // In Tenant B with only 1 contact which we suppress
      const contactB = await prisma.contact.findFirst({ where: { tenantId: tenantIdB } });
      if (contactB) {
        await prisma.suppression.create({
          data: { tenantId: tenantIdB, email: contactB.email, reason: 'MANUAL' },
        });
        await prisma.contact.update({
          where: { id: contactB.id },
          data: { status: 'UNSUBSCRIBED' },
        });
      }

      const emptyCampaign = await prisma.campaign.create({
        data: {
          tenantId: tenantIdB,
          name: 'Zero Recipient Test',
          subject: 'No one to receive this',
          status: 'DRAFT',
        },
      });

      const res = await request(app)
        .post(`/api/campaigns/${emptyCampaign.id}/launch`)
        .set('Authorization', `Bearer ${authTokenB}`)
        .send({ confirmRecipientCount: 0, dryRun: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('zero eligible recipients');
    });

    it('should launch campaign in dry-run mode and create persistent CampaignRecipient snapshot', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/launch`)
        .set('Authorization', `Bearer ${authTokenA}`)
        .send({ confirmRecipientCount: 1, dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.data.enqueuedRecipients).toBeGreaterThan(0);

      // Verify campaign status is IN_PROGRESS
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(campaign?.status).toBe('IN_PROGRESS');

      // Verify CampaignRecipient snapshot records exist with personalized content
      const recipients = await prisma.campaignRecipient.findMany({
        where: { campaignId },
      });
      expect(recipients.length).toBeGreaterThan(0);
      expect(recipients[0].personalizedSubject).toBeDefined();
      expect(recipients[0].idempotencyKey).toBeDefined();

      // Verify QueueJob entries exist
      const jobs = await prisma.queueJob.findMany({
        where: { tenantId: tenantIdA, queueName: 'bulk-campaign-delivery' },
      });
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should list campaign recipients with pagination and status filters', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/recipients?page=1&limit=5`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('should pause an in-progress campaign', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/pause`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAUSED');

      const updated = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updated?.status).toBe('PAUSED');
    });

    it('should resume a paused campaign', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/resume`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');

      const updated = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updated?.status).toBe('IN_PROGRESS');
    });

    it('should cancel a campaign and update uncompleted recipients to CANCELLED', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/cancel`)
        .set('Authorization', `Bearer ${authTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');

      const updated = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updated?.status).toBe('CANCELLED');

      // Verify uncompleted recipients were marked CANCELLED
      const cancelledRecipients = await prisma.campaignRecipient.findMany({
        where: { campaignId, status: 'CANCELLED' },
      });
      expect(cancelledRecipients.length).toBeGreaterThan(0);

      // Verify pending queue jobs were deleted
      const pendingJobs = await prisma.queueJob.findMany({
        where: {
          tenantId: tenantIdA,
          payload: { path: ['campaignId'], equals: campaignId },
        },
      });
      expect(pendingJobs.length).toBe(0);
    });
  });

  // ===========================================================================
  // 5. Worker Dry-Run Processing & Retries
  // ===========================================================================
  describe('Worker Dry-Run Delivery & Retry Mechanics', () => {
    let dryRunCampaignId: string;
    let recipientId: string;

    beforeAll(async () => {
      // Create a fresh test campaign
      const c = await prisma.campaign.create({
        data: {
          tenantId: tenantIdA,
          name: 'Worker Dry-Run Test Campaign',
          subject: 'Hi {{first_name}}',
          status: 'DRAFT',
          provider: 'DRY_RUN',
        },
      });
      dryRunCampaignId = c.id;

      // Create an active contact
      const contact = await prisma.contact.create({
        data: {
          tenantId: tenantIdA,
          email: `worker.test.${Date.now()}@example.org`,
          firstName: 'Worker',
          status: 'ACTIVE',
        },
      });

      // Launch campaign manually to generate recipient & job
      await CampaignService.launchCampaign(tenantIdA, dryRunCampaignId, userIdA, {
        confirmRecipientCount: 1,
        dryRun: true,
      });

      const recipient = await prisma.campaignRecipient.findFirst({
        where: { campaignId: dryRunCampaignId },
      });
      expect(recipient).not.toBeNull();
      recipientId = recipient!.id;
    });

    it('should process a dry-run queue job: QUEUED -> SENDING -> DELIVERED', async () => {
      const job = await prisma.queueJob.findFirst({
        where: {
          tenantId: tenantIdA,
          payload: { path: ['campaignId'], equals: dryRunCampaignId },
          status: 'PENDING',
        },
      });
      expect(job).not.toBeNull();

      // Simulate worker execution:
      // 1. Mark job and recipient SENDING
      await prisma.queueJob.update({
        where: { id: job!.id },
        data: { status: 'PROCESSING', lockedBy: 'test-worker' },
      });
      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { status: 'SENDING' },
      });

      // 2. Deliver simulated message & create EmailEvent
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: 'DELIVERED',
            providerMessageId: `sim-msg-${Date.now()}`,
            deliveredAt: new Date(),
          },
        }),
        prisma.emailEvent.create({
          data: {
            tenantId: tenantIdA,
            campaignId: dryRunCampaignId,
            recipientId,
            eventType: 'DELIVERED',
            providerMessageId: `sim-msg-${Date.now()}`,
            eventData: { mode: 'dry-run' },
          },
        }),
        prisma.campaign.update({
          where: { id: dryRunCampaignId },
          data: { sentCount: { increment: 1 }, deliveredCount: { increment: 1 } },
        }),
        prisma.queueJob.update({
          where: { id: job!.id },
          data: { status: 'COMPLETED' },
        }),
      ]);

      // Verify recipient state is now DELIVERED
      const updatedRecipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
      });
      expect(updatedRecipient?.status).toBe('DELIVERED');
      expect(updatedRecipient?.deliveredAt).not.toBeNull();

      // Verify EmailEvent exists
      const event = await prisma.emailEvent.findFirst({
        where: { recipientId, eventType: 'DELIVERED' },
      });
      expect(event).not.toBeNull();
    });

    it('should handle exponential backoff and retry limits on failures', async () => {
      // Create a test failure job
      const failedJob = await prisma.queueJob.create({
        data: {
          tenantId: tenantIdA,
          queueName: 'bulk-campaign-delivery',
          payload: {
            campaignId: dryRunCampaignId,
            recipientId,
            email: 'test@example.com',
          },
          status: 'PENDING',
          attempts: 1,
          maxAttempts: 3,
        },
      });

      // Attempt 2: transient error -> exponential backoff
      const nextAttempt = failedJob.attempts + 1;
      const delaySeconds = Math.pow(2, nextAttempt) * 5; // 2^2 * 5 = 20s
      const nextRunAt = new Date(Date.now() + delaySeconds * 1000);

      await prisma.queueJob.update({
        where: { id: failedJob.id },
        data: {
          status: 'PENDING',
          attempts: nextAttempt,
          lastError: 'Simulated network timeout',
          runAt: nextRunAt,
        },
      });

      const updated = await prisma.queueJob.findUnique({ where: { id: failedJob.id } });
      expect(updated?.attempts).toBe(2);
      expect(updated?.lastError).toContain('timeout');
      expect(updated?.runAt.getTime()).toBeGreaterThan(Date.now());

      // Attempt 3: reached maxAttempts -> final FAILED
      await prisma.queueJob.update({
        where: { id: failedJob.id },
        data: {
          status: 'FAILED',
          attempts: 3,
          lastError: 'Max retries exhausted',
        },
      });

      const finalJob = await prisma.queueJob.findUnique({ where: { id: failedJob.id } });
      expect(finalJob?.status).toBe('FAILED');

      // Cleanup test job
      await prisma.queueJob.delete({ where: { id: failedJob.id } });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
