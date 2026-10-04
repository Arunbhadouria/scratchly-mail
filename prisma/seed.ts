import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create or ensure Demo Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Acme Growth Labs',
      slug: 'demo-workspace',
    },
  });

  console.log(`🏢 Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Create Admin User
  const passwordHash = await bcrypt.hash('ScratchlyAdmin123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@scratchly.local' },
    update: { passwordHash },
    create: {
      email: 'admin@scratchly.local',
      name: 'Jordan Mitchell',
      passwordHash,
    },
  });

  // 3. Create Tenant Membership
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  console.log(`👤 Admin user created: ${user.email}`);

  // 4. Create Sample Contacts
  const sampleContacts = [
    {
      email: 'sarah.connor@cyberdyne.io',
      firstName: 'Sarah',
      lastName: 'Connor',
      company: 'Cyberdyne Systems',
      phone: '+1 555-0100',
      source: 'manual',
      consentGivenAt: new Date(),
      consentProof: 'Web sign-up form opt-in checkbox',
    },
    {
      email: 'john.doe@techcorp.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'TechCorp International',
      phone: '+1 555-0101',
      source: 'csv_import',
      consentGivenAt: new Date(),
      consentProof: 'Verified opt-in CSV import 2026-09',
    },
    {
      email: 'elena.rostova@nexusdynamics.net',
      firstName: 'Elena',
      lastName: 'Rostova',
      company: 'Nexus Dynamics',
      phone: '+1 555-0102',
      source: 'scratchly_crm',
      externalScratchlyId: 'crm-contact-9842',
      consentGivenAt: new Date(),
      consentProof: 'CRM lead conversion form',
    },
    {
      email: 'marcus.vance@vanguardanalytics.org',
      firstName: 'Marcus',
      lastName: 'Vance',
      company: 'Vanguard Analytics',
      phone: '+1 555-0103',
      source: 'csv_import',
      consentGivenAt: new Date(),
      consentProof: 'Webinar attendee list',
    },
    {
      email: 'bounced.lead@inactive-domain.invalid',
      firstName: 'Inactive',
      lastName: 'Lead',
      company: 'Old Corp',
      phone: '+1 555-0199',
      source: 'csv_import',
      status: 'BOUNCED' as const,
      consentGivenAt: new Date(),
      consentProof: 'Historical customer record',
    },
  ];

  for (const c of sampleContacts) {
    await prisma.contact.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: c.email,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...c,
      },
    });
  }

  // 5. Add a suppression record to demonstrate exclusion handling
  await prisma.suppression.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'bounced.lead@inactive-domain.invalid',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'bounced.lead@inactive-domain.invalid',
      reason: 'BOUNCE',
      notes: 'Initial seed permanent bounce record for testing exclusion engine',
    },
  });

  console.log(`👥 Contacts and suppressions seeded.`);

  // 6. Create Sample Email Templates
  const template1 = await prisma.emailTemplate.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      name: 'Product Introduction & Value Proposition',
      subject: 'Quick question regarding growth at {{company}}',
      previewText: 'Loved what your team is building — wanted to share a quick idea.',
      bodyHtml: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1e293b;">
  <p>Hi {{first_name}},</p>
  <p>I hope your week is off to a great start. I've been following what <strong>{{company}}</strong> has been working on recently, and wanted to reach out directly.</p>
  <p>We recently built a new approach to automated CRM engagement and pipeline nurturing that has helped similar growth teams reduce outreach setup time by 75%.</p>
  <p>Would you be open to a 10-minute chat this Thursday to see if it makes sense for your team?</p>
  <p>Best regards,<br/><strong>Jordan Mitchell</strong><br/>Acme Growth Labs</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #94a3b8;">You received this email because you opted in to updates from Acme Growth Labs. <a href="#" style="color: #6366f1;">Unsubscribe</a></p>
</div>
      `.trim(),
      bodyText: `Hi {{first_name}},\n\nI hope your week is off to a great start. I've been following what {{company}} has been working on recently, and wanted to reach out directly.\n\nWe recently built a new approach to automated CRM engagement that has helped similar teams reduce outreach setup time by 75%.\n\nWould you be open to a 10-minute chat this Thursday?\n\nBest regards,\nJordan Mitchell\nAcme Growth Labs`,
    },
  });

  const template2 = await prisma.emailTemplate.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      name: 'Webinar Invitation & VIP Pass',
      subject: 'Exclusive Invitation: Modern CRM Outreach Strategy for {{first_name}}',
      previewText: 'Save your seat for our upcoming live architecture workshop.',
      bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
  <h2 style="color: #4338ca;">Live Workshop: Modern Outreach Architecture</h2>
  <p>Hello {{first_name}},</p>
  <p>We are hosting a private technical session on how modern engineering teams separate mailbox operations from high-throughput bulk campaigns.</p>
  <p>Given your role at <strong>{{company}}</strong>, we reserved an early-bird pass under <code>{{email}}</code>.</p>
  <p style="margin: 28px 0;"><a href="https://example.com/register" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Claim Your Seat &rarr;</a></p>
  <p>Hope to see you there,<br/>The Engineering Team</p>
</div>
      `.trim(),
      bodyText: `Hello {{first_name}},\n\nWe reserved an early-bird pass for you at {{company}} ({{email}}) for our upcoming session.\n\nClaim seat at https://example.com/register`,
    },
  });

  console.log(`📄 Sample email templates created: ${template1.name}, ${template2.name}`);

  // 7. Create a Sample Campaign
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      name: 'Q4 Early Access Outreach',
      subject: template1.subject,
      templateId: template1.id,
      status: 'DRAFT',
      provider: 'DRY_RUN',
    },
  });

  console.log(`🎯 Sample campaign created: ${campaign.name} (${campaign.id})`);
  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
