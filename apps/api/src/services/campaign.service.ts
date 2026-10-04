import { prisma } from '../lib/db.js';
import { env } from '../config/env.js';
import {
  CampaignCreateInput,
  CampaignUpdateInput,
  CampaignLaunchInput,
  CampaignRecipientsQuery,
  renderTemplatePlaceholders,
  sanitizeHtmlContent,
} from '@scratchly/shared';
import crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CampaignService {
  static async listCampaigns(tenantId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true },
        },
        _count: {
          select: { recipients: true },
        },
      },
    });

    return campaigns;
  }

  static async getCampaignById(tenantId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        template: true,
        _count: {
          select: { recipients: true, events: true },
        },
      },
    });

    if (!campaign) {
      throw { status: 404, message: 'Campaign not found' };
    }

    // Aggregate recipient statistics by status
    const statusGroups = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {
      QUEUED: 0,
      SENDING: 0,
      ACCEPTED: 0,
      DELIVERED: 0,
      BOUNCED: 0,
      FAILED: 0,
      CANCELLED: 0,
      SUPPRESSED: 0,
    };

    for (const group of statusGroups) {
      statusCounts[group.status] = group._count.id;
    }

    return {
      ...campaign,
      statusCounts,
    };
  }

  static async listCampaignRecipients(tenantId: string, campaignId: string, query: CampaignRecipientsQuery) {
    // Verify campaign existence and tenant ownership
    await this.getCampaignById(tenantId, campaignId);

    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;

    const where: any = { campaignId, tenantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { personalizedSubject: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const [total, recipients] = await Promise.all([
      prisma.campaignRecipient.count({ where }),
      prisma.campaignRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, company: true },
          },
        },
      }),
    ]);

    return {
      recipients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createCampaign(tenantId: string, userId: string, input: CampaignCreateInput) {
    let bodyHtml = input.bodyHtml;
    let bodyText = input.bodyText;
    let subject = input.subject;

    if (input.templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: input.templateId, tenantId },
      });
      if (!template) {
        throw { status: 400, message: 'Selected template not found' };
      }
      bodyHtml = template.bodyHtml;
      bodyText = template.bodyText;
      if (!subject) {
        subject = template.subject;
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        createdById: userId,
        name: input.name,
        subject: subject || input.name,
        templateId: input.templateId && input.templateId.trim() !== '' ? input.templateId : null,
        status: 'DRAFT',
        provider: input.provider === 'SES_BULK' && env.CAMPAIGN_SENDING_MODE === 'ses' ? 'SES_BULK' : 'DRY_RUN',
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_CREATED',
        entityType: 'Campaign',
        entityId: campaign.id,
        details: {
          name: campaign.name,
          subject: campaign.subject,
          templateId: campaign.templateId,
          provider: campaign.provider,
        },
      },
    });

    return campaign;
  }

  static async updateCampaign(tenantId: string, id: string, userId: string, input: CampaignUpdateInput) {
    const campaign = await this.getCampaignById(tenantId, id);
    if (campaign.status !== 'DRAFT') {
      throw { status: 400, message: 'Only campaigns in DRAFT status can be modified' };
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        subject: input.subject || undefined,
        templateId: input.templateId,
        provider: input.provider,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_UPDATED',
        entityType: 'Campaign',
        entityId: id,
        details: { name: updated.name },
      },
    });

    return updated;
  }

  /**
   * Calculates pre-flight summary with complete audience exclusions breakdown.
   */
  static async previewAudience(tenantId: string, campaignId: string) {
    await this.getCampaignById(tenantId, campaignId);

    // Get all contacts in tenant
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    // Get suppressions
    const suppressions = await prisma.suppression.findMany({
      where: { tenantId },
      select: { email: true, reason: true },
    });
    const suppressionMap = new Map(suppressions.map((s) => [s.email.toLowerCase(), s.reason]));

    const seenEmails = new Set<string>();
    let invalidEmailCount = 0;
    let duplicateCount = 0;
    let unsubscribedCount = 0;
    let suppressedCount = 0;

    const eligibleContacts: typeof contacts = [];

    for (const contact of contacts) {
      const email = contact.email.toLowerCase().trim();

      // Check format
      if (!EMAIL_REGEX.test(email)) {
        invalidEmailCount++;
        continue;
      }

      // Check duplicate
      if (seenEmails.has(email)) {
        duplicateCount++;
        continue;
      }
      seenEmails.add(email);

      // Check unsubscribe status
      if (contact.status === 'UNSUBSCRIBED' || suppressionMap.get(email) === 'UNSUBSCRIBE') {
        unsubscribedCount++;
        continue;
      }

      // Check other suppressions
      if (suppressionMap.has(email) || contact.status === 'BOUNCED' || contact.status === 'COMPLAINED') {
        suppressedCount++;
        continue;
      }

      // Check active
      if (contact.status !== 'ACTIVE') {
        suppressedCount++;
        continue;
      }

      eligibleContacts.push(contact);
    }

    return {
      totalSelected: contacts.length,
      eligibleCount: eligibleContacts.length,
      suppressedCount,
      unsubscribedCount,
      invalidEmailCount,
      duplicateCount,
      finalSendableCount: eligibleContacts.length,
      sampleEligible: eligibleContacts.slice(0, 5).map((c) => ({
        id: c.id,
        email: c.email,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
        company: c.company,
      })),
      suppressionExclusions: suppressions.slice(0, 5),
    };
  }

  /**
   * Launches the campaign. Creates recipient records with personalizations,
   * enqueues them into the QueueJob table, and updates campaign status.
   */
  static async launchCampaign(tenantId: string, campaignId: string, userId: string, input: CampaignLaunchInput) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
      throw { status: 400, message: `Campaign cannot be launched from current status: ${campaign.status}` };
    }

    const template = campaign.templateId
      ? await prisma.emailTemplate.findUnique({ where: { id: campaign.templateId } })
      : null;

    const baseHtml = template?.bodyHtml || '<p>Hello {{first_name}},</p>';
    const baseText = template?.bodyText || '';
    const subjectTemplate = campaign.subject;

    // Fetch contacts and suppressions
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const suppressions = await prisma.suppression.findMany({
      where: { tenantId },
      select: { email: true, reason: true },
    });
    const suppressionMap = new Map(suppressions.map((s) => [s.email.toLowerCase(), s.reason]));

    const seenEmails = new Set<string>();
    const eligibleContacts: typeof contacts = [];

    for (const contact of contacts) {
      const email = contact.email.toLowerCase().trim();
      if (!EMAIL_REGEX.test(email) || seenEmails.has(email)) {
        continue;
      }
      seenEmails.add(email);

      if (
        contact.status !== 'ACTIVE' ||
        suppressionMap.has(email)
      ) {
        continue;
      }

      eligibleContacts.push(contact);
    }

    if (eligibleContacts.length === 0) {
      throw {
        status: 400,
        message: 'Cannot launch campaign: zero eligible recipients found after suppression, duplicate, and validity filtering.',
      };
    }

    const isDryRun = input.dryRun || input.provider === 'DRY_RUN';
    const providerToUse = isDryRun
      ? 'DRY_RUN'
      : (input.provider === 'SES_BULK' || campaign.provider === 'SES_BULK' || env.CAMPAIGN_SENDING_MODE === 'ses' || !!env.AWS_ACCESS_KEY_ID
        ? 'SES_BULK'
        : 'DRY_RUN');

    // Prepare batch creation in database transaction
    await prisma.$transaction(async (tx) => {
      // Create CampaignRecipient records
      const recipientData = eligibleContacts.map((contact) => {
        const vars = {
          first_name: contact.firstName || 'there',
          last_name: contact.lastName || '',
          email: contact.email,
          company: contact.company || 'your team',
        };

        const personalizedSubject = renderTemplatePlaceholders(subjectTemplate, vars, { escapeValues: false });
        const personalizedHtml = renderTemplatePlaceholders(sanitizeHtmlContent(baseHtml), vars, { escapeValues: true });
        const personalizedText = renderTemplatePlaceholders(baseText, vars, { escapeValues: false });

        const idempotencyKey = crypto
          .createHash('sha256')
          .update(`${campaignId}:${contact.id}:${contact.email}`)
          .digest('hex');

        return {
          tenantId,
          campaignId,
          contactId: contact.id,
          email: contact.email,
          personalizedSubject,
          personalizedHtml,
          personalizedText,
          status: 'QUEUED' as const,
          idempotencyKey,
        };
      });

      // Insert recipients (skip duplicates if re-launching)
      await tx.campaignRecipient.createMany({
        data: recipientData,
        skipDuplicates: true,
      });

      // Retrieve created recipients to populate queue jobs
      const createdRecipients = await tx.campaignRecipient.findMany({
        where: { campaignId, status: 'QUEUED' },
        select: { id: true, email: true },
      });

      // Create queue jobs
      const jobs = createdRecipients.map((r) => ({
        tenantId,
        queueName: 'bulk-campaign-delivery',
        payload: {
          campaignId,
          recipientId: r.id,
          email: r.email,
          provider: providerToUse,
        },
        status: 'PENDING' as const,
        priority: 1,
      }));

      await tx.queueJob.createMany({ data: jobs });

      // Update campaign
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'IN_PROGRESS',
          provider: providerToUse,
          totalRecipients: createdRecipients.length,
          startedAt: new Date(),
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CAMPAIGN_LAUNCHED',
          entityType: 'Campaign',
          entityId: campaignId,
          details: {
            recipientCount: createdRecipients.length,
            provider: providerToUse,
            dryRun: providerToUse === 'DRY_RUN',
          },
        },
      });
    });

    return {
      success: true,
      campaignId,
      enqueuedRecipients: eligibleContacts.length,
      provider: providerToUse,
    };
  }

  static async pauseCampaign(tenantId: string, campaignId: string, userId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if (campaign.status !== 'IN_PROGRESS') {
      throw { status: 400, message: 'Only active campaigns in progress can be paused' };
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_PAUSED',
        entityType: 'Campaign',
        entityId: campaignId,
      },
    });

    return { success: true, status: 'PAUSED' };
  }

  static async resumeCampaign(tenantId: string, campaignId: string, userId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if (campaign.status !== 'PAUSED') {
      throw { status: 400, message: 'Only paused campaigns can be resumed' };
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'IN_PROGRESS' },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_RESUMED',
        entityType: 'Campaign',
        entityId: campaignId,
      },
    });

    return { success: true, status: 'IN_PROGRESS' };
  }

  static async cancelCampaign(tenantId: string, campaignId: string, userId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);

    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw { status: 400, message: `Campaign is already in ${campaign.status} status` };
    }

    // Cancel pending queue jobs and set uncompleted recipients to CANCELLED
    await prisma.$transaction(async (tx) => {
      // Remove pending jobs
      await tx.queueJob.deleteMany({
        where: {
          tenantId,
          payload: { path: ['campaignId'], equals: campaignId },
          status: 'PENDING',
        },
      });

      // Update remaining queued/sending recipients to CANCELLED
      await tx.campaignRecipient.updateMany({
        where: {
          campaignId,
          status: { in: ['QUEUED', 'SENDING'] },
        },
        data: { status: 'CANCELLED', lastError: 'Campaign cancelled by user' },
      });

      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CAMPAIGN_CANCELLED',
          entityType: 'Campaign',
          entityId: campaignId,
        },
      });
    });

    return { success: true, status: 'CANCELLED' };
  }
}
