import { prisma } from '../lib/db.js';
import {
  ContactCreateInput,
  ContactUpdateInput,
  ContactQuery,
  CSVImportInput,
} from '@scratchly/shared';

export class ContactService {
  static async listContacts(tenantId: string, query: ContactQuery) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;

    // Fetch suppressed emails for tenant to support eligibility filtering and badge enrichment
    const suppressions = await prisma.suppression.findMany({
      where: { tenantId },
      select: { email: true, reason: true },
    });
    const suppressionMap = new Map(suppressions.map((s) => [s.email.toLowerCase(), s.reason]));
    const suppressedEmails = Array.from(suppressionMap.keys());

    const where: any = { tenantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.eligibility === 'eligible') {
      where.status = 'ACTIVE';
      if (suppressedEmails.length > 0) {
        where.email = { notIn: suppressedEmails };
      }
    } else if (query.eligibility === 'suppressed') {
      if (suppressedEmails.length > 0) {
        where.OR = [
          { status: { not: 'ACTIVE' } },
          { email: { in: suppressedEmails } },
        ];
      } else {
        where.status = { not: 'ACTIVE' };
      }
    }

    if (query.search) {
      const searchCondition = [
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { firstName: { contains: query.search, mode: 'insensitive' as const } },
        { lastName: { contains: query.search, mode: 'insensitive' as const } },
        { company: { contains: query.search, mode: 'insensitive' as const } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchCondition },
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    if (query.company) {
      where.company = { contains: query.company, mode: 'insensitive' };
    }

    if (query.source) {
      where.source = query.source;
    }

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      }),
    ]);

    // Enrich contacts with suppression flags
    const enrichedContacts = contacts.map((c) => {
      const suppressionReason = suppressionMap.get(c.email.toLowerCase());
      const isSuppressed = !!suppressionReason || c.status !== 'ACTIVE';
      return {
        ...c,
        isSuppressed,
        suppressionReason: suppressionReason || (c.status !== 'ACTIVE' ? c.status : null),
        isEligible: c.status === 'ACTIVE' && !suppressionReason,
      };
    });

    return {
      contacts: enrichedContacts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getContactById(tenantId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        campaignRecipients: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { campaign: { select: { id: true, name: true, subject: true, status: true } } },
        },
      },
    });

    if (!contact) {
      throw { status: 404, message: 'Contact not found' };
    }

    const suppression = await prisma.suppression.findUnique({
      where: { tenantId_email: { tenantId, email: contact.email.toLowerCase() } },
    });

    return {
      ...contact,
      isSuppressed: !!suppression || contact.status !== 'ACTIVE',
      suppressionReason: suppression?.reason || (contact.status !== 'ACTIVE' ? contact.status : null),
      isEligible: contact.status === 'ACTIVE' && !suppression,
    };
  }

  static async createContact(tenantId: string, input: ContactCreateInput, userId?: string) {
    const email = input.email.toLowerCase().trim();

    // Check suppression list first
    const suppression = await prisma.suppression.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    const initialStatus = suppression
      ? suppression.reason === 'UNSUBSCRIBE'
        ? 'UNSUBSCRIBED'
        : 'BOUNCED'
      : 'ACTIVE';

    const existing = await prisma.contact.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (existing) {
      throw { status: 409, message: `Contact with email '${email}' already exists in this workspace.` };
    }

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        company: input.company,
        phone: input.phone,
        source: input.source || 'manual',
        status: initialStatus,
        consentGivenAt: input.consentGiven ? new Date() : null,
        consentProof: input.consentProof,
        externalScratchlyId: input.externalScratchlyId,
        customFields: input.customFields || {},
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACT_CREATED',
        entityType: 'Contact',
        entityId: contact.id,
        details: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          source: contact.source,
          consentGiven: input.consentGiven,
        },
      },
    });

    return {
      ...contact,
      isSuppressed: initialStatus !== 'ACTIVE',
      suppressionReason: suppression?.reason || (initialStatus !== 'ACTIVE' ? initialStatus : null),
      isEligible: initialStatus === 'ACTIVE',
    };
  }

  static async updateContact(tenantId: string, id: string, input: ContactUpdateInput, userId?: string) {
    const existing = await this.getContactById(tenantId, id);

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        firstName: input.firstName !== undefined ? input.firstName : undefined,
        lastName: input.lastName !== undefined ? input.lastName : undefined,
        company: input.company !== undefined ? input.company : undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
        consentProof: input.consentProof !== undefined ? input.consentProof : undefined,
        externalScratchlyId: input.externalScratchlyId !== undefined ? input.externalScratchlyId : undefined,
        customFields: input.customFields !== undefined ? input.customFields : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACT_UPDATED',
        entityType: 'Contact',
        entityId: id,
        details: {
          email: existing.email,
          updatedFields: Object.keys(input),
        },
      },
    });

    return updated;
  }

  static async deleteContact(tenantId: string, id: string, userId?: string) {
    const existing = await this.getContactById(tenantId, id);
    const deleted = await prisma.contact.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACT_DELETED',
        entityType: 'Contact',
        entityId: id,
        details: {
          email: existing.email,
        },
      },
    });

    return deleted;
  }

  static async suppressContact(
    tenantId: string,
    id: string,
    reason: 'UNSUBSCRIBE' | 'BOUNCE' | 'COMPLAINT' | 'MANUAL' = 'MANUAL',
    notes?: string,
    userId?: string
  ) {
    const contact = await this.getContactById(tenantId, id);
    const email = contact.email.toLowerCase();

    // Upsert suppression
    await prisma.suppression.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { reason, notes: notes || 'Manually suppressed by admin' },
      create: {
        tenantId,
        email,
        reason,
        notes: notes || 'Manually suppressed by admin',
      },
    });

    const newStatus = reason === 'BOUNCE' ? 'BOUNCED' : reason === 'COMPLAINT' ? 'COMPLAINED' : 'UNSUBSCRIBED';

    const updated = await prisma.contact.update({
      where: { id },
      data: { status: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACT_SUPPRESSED',
        entityType: 'Contact',
        entityId: id,
        details: { email, reason, notes },
      },
    });

    return updated;
  }

  static async unsuppressContact(tenantId: string, id: string, userId?: string) {
    const contact = await this.getContactById(tenantId, id);
    const email = contact.email.toLowerCase();

    // Delete suppression if exists
    await prisma.suppression.deleteMany({
      where: { tenantId, email },
    });

    const updated = await prisma.contact.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACT_UNSUPPRESSED',
        entityType: 'Contact',
        entityId: id,
        details: { email },
      },
    });

    return updated;
  }

  static async importBatch(tenantId: string, input: CSVImportInput, userId?: string) {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ email: string; error: string }> = [];

    // Fetch existing suppressed emails in this tenant
    const suppressions = await prisma.suppression.findMany({
      where: { tenantId },
      select: { email: true, reason: true },
    });
    const suppressionMap = new Map(suppressions.map((s) => [s.email.toLowerCase(), s.reason]));

    for (const row of input.contacts) {
      const email = row.email.toLowerCase().trim();
      try {
        const isSuppressed = suppressionMap.has(email);
        const status = isSuppressed ? 'UNSUBSCRIBED' : 'ACTIVE';

        await prisma.contact.upsert({
          where: { tenantId_email: { tenantId, email } },
          update: {
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            company: row.company || undefined,
            phone: row.phone || undefined,
            externalScratchlyId: row.externalScratchlyId || undefined,
          },
          create: {
            tenantId,
            email,
            firstName: row.firstName,
            lastName: row.lastName,
            company: row.company,
            phone: row.phone,
            source: row.source || input.defaultSource,
            status,
            consentGivenAt: row.consentGiven ? new Date() : null,
            consentProof: row.consentProof,
            externalScratchlyId: row.externalScratchlyId,
            customFields: row.customFields || {},
          },
        });
        imported++;
      } catch (err: any) {
        skipped++;
        errors.push({ email, error: err.message || 'Unknown error' });
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'CONTACTS_IMPORTED',
        entityType: 'Contact',
        details: {
          totalSubmitted: input.contacts.length,
          imported,
          skipped,
          errorCount: errors.length,
        },
      },
    });

    return { imported, skipped, errors };
  }
}
