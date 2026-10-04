import { prisma } from '../lib/db.js';
import {
  TemplateCreateInput,
  TemplateUpdateInput,
  TemplatePreviewInput,
  renderTemplatePlaceholders,
  sanitizeHtmlContent,
} from '@scratchly/shared';

export class TemplateService {
  static async listTemplates(tenantId: string) {
    return prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });
  }

  static async getTemplateById(tenantId: string, id: string) {
    const template = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw { status: 404, message: 'Template not found' };
    }

    return template;
  }

  static async createTemplate(tenantId: string, userId: string, input: TemplateCreateInput) {
    const sanitizedHtml = sanitizeHtmlContent(input.bodyHtml);

    const template = await prisma.emailTemplate.create({
      data: {
        tenantId,
        createdById: userId,
        name: input.name,
        subject: input.subject,
        bodyHtml: sanitizedHtml,
        bodyText: input.bodyText || null,
        previewText: input.previewText || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TEMPLATE_CREATED',
        entityType: 'EmailTemplate',
        entityId: template.id,
        details: { name: template.name, subject: template.subject },
      },
    });

    return template;
  }

  static async updateTemplate(tenantId: string, id: string, userId: string, input: TemplateUpdateInput) {
    const existing = await this.getTemplateById(tenantId, id);

    const data: any = { ...input };
    if (input.bodyHtml) {
      data.bodyHtml = sanitizeHtmlContent(input.bodyHtml);
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TEMPLATE_UPDATED',
        entityType: 'EmailTemplate',
        entityId: id,
        details: { name: updated.name, subject: updated.subject },
      },
    });

    return updated;
  }

  static async deleteTemplate(tenantId: string, id: string, userId: string) {
    const template = await this.getTemplateById(tenantId, id);

    const deleted = await prisma.emailTemplate.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TEMPLATE_DELETED',
        entityType: 'EmailTemplate',
        entityId: id,
        details: { name: template.name },
      },
    });

    return deleted;
  }

  static async duplicateTemplate(tenantId: string, id: string, userId: string) {
    const original = await this.getTemplateById(tenantId, id);

    const copy = await prisma.emailTemplate.create({
      data: {
        tenantId,
        createdById: userId,
        name: `Copy of ${original.name}`,
        subject: original.subject,
        bodyHtml: original.bodyHtml,
        bodyText: original.bodyText,
        previewText: original.previewText,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TEMPLATE_DUPLICATED',
        entityType: 'EmailTemplate',
        entityId: copy.id,
        details: { sourceTemplateId: original.id, newName: copy.name },
      },
    });

    return copy;
  }

  static preview(input: TemplatePreviewInput) {
    const sample = input.sampleData || {
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'alex@example.com',
      company: 'Acme Growth Labs',
    };

    const renderedSubject = renderTemplatePlaceholders(input.subject, sample, { escapeValues: false });
    const renderedHtml = renderTemplatePlaceholders(sanitizeHtmlContent(input.bodyHtml), sample, { escapeValues: true });
    const renderedText = input.bodyText
      ? renderTemplatePlaceholders(input.bodyText, sample, { escapeValues: false })
      : null;

    return {
      subject: renderedSubject,
      html: renderedHtml,
      text: renderedText,
      appliedVariables: sample,
    };
  }
}
