import { prisma } from '../lib/db.js';

export class AnalyticsService {
  static async getDashboardOverview(tenantId: string) {
    const [
      totalContacts,
      activeContacts,
      unsubscribedContacts,
      bouncedContacts,
      suppressionCount,
      campaignCounts,
      recentCampaigns,
      recentEvents,
      recentAuditLogs,
      emailConnections,
    ] = await Promise.all([
      prisma.contact.count({ where: { tenantId } }),
      prisma.contact.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.contact.count({ where: { tenantId, status: 'UNSUBSCRIBED' } }),
      prisma.contact.count({ where: { tenantId, status: 'BOUNCED' } }),
      prisma.suppression.count({ where: { tenantId } }),
      prisma.campaign.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.campaign.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { name: true } },
          _count: { select: { recipients: true } },
        },
      }),
      prisma.emailEvent.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { occurredAt: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
          recipient: { select: { id: true, email: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.emailConnection.count({ where: { tenantId, status: 'CONNECTED' } }),
    ]);

    // Aggregate campaign recipient counts
    const deliveryAggregates = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const statusMap = deliveryAggregates.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Total recipients across campaigns
    const totalRecipients = Object.values(statusMap).reduce((sum, count) => sum + count, 0);
    const deliveredCount = (statusMap['DELIVERED'] || 0) + (statusMap['ACCEPTED'] || 0);
    const deliveryRate = totalRecipients > 0 ? Math.round((deliveredCount / totalRecipients) * 100) : 0;

    // Campaigns breakdown
    const campaignsByStatus = campaignCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    const totalCampaigns = Object.values(campaignsByStatus).reduce((a, b) => a + b, 0);
    const activeCampaigns = (campaignsByStatus['IN_PROGRESS'] || 0) + (campaignsByStatus['QUEUED'] || 0);

    // Eligible contacts calculation: contacts that are ACTIVE and not in suppression
    // A quick count query or estimation:
    const suppressedEmails = await prisma.suppression.findMany({
      where: { tenantId },
      select: { email: true },
    });
    const suppressedSet = new Set(suppressedEmails.map((s) => s.email.toLowerCase()));

    const activeContactRecords = await prisma.contact.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { email: true },
    });
    const eligibleContactsCount = activeContactRecords.filter(
      (c) => !suppressedSet.has(c.email.toLowerCase())
    ).length;

    // Combine recent activity
    const activityItems = [
      ...recentEvents.map((e) => ({
        id: e.id,
        type: `EMAIL_${e.eventType}`,
        title: `Simulated Email ${e.eventType.toLowerCase()}`,
        description: `Delivered to ${e.recipient?.email || 'recipient'} for "${e.campaign?.name || 'Campaign'}"`,
        timestamp: e.occurredAt,
        badgeColor: e.eventType === 'DELIVERED' || e.eventType === 'ACCEPTED' ? 'emerald' : 'amber',
      })),
      ...recentAuditLogs.map((a) => ({
        id: a.id,
        type: `AUDIT_${a.action}`,
        title: a.action.replace(/_/g, ' '),
        description: `Triggered by ${a.user?.name || a.user?.email || 'System'} on ${a.entityType}`,
        timestamp: a.createdAt,
        badgeColor: a.action.includes('LAUNCHED') ? 'blue' : a.action.includes('DELETED') || a.action.includes('CANCELLED') ? 'rose' : 'slate',
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);

    return {
      isDryRunMode: true,
      contacts: {
        total: totalContacts,
        active: activeContacts,
        eligible: eligibleContactsCount,
        suppressed: suppressionCount + (totalContacts - activeContacts),
        unsubscribed: unsubscribedContacts,
        bounced: bouncedContacts,
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        completed: campaignsByStatus['COMPLETED'] || 0,
        draft: campaignsByStatus['DRAFT'] || 0,
        paused: campaignsByStatus['PAUSED'] || 0,
        cancelled: campaignsByStatus['CANCELLED'] || 0,
        byStatus: campaignsByStatus,
      },
      delivery: {
        totalRecipients,
        queued: statusMap['QUEUED'] || 0,
        sending: statusMap['SENDING'] || 0,
        accepted: statusMap['ACCEPTED'] || 0,
        delivered: statusMap['DELIVERED'] || 0,
        bounced: statusMap['BOUNCED'] || 0,
        complained: statusMap['COMPLAINED'] || 0,
        failed: statusMap['FAILED'] || 0,
        cancelled: statusMap['CANCELLED'] || 0,
        suppressed: statusMap['SUPPRESSED'] || 0,
        deliveryRate,
      },
      connectedAccounts: emailConnections,
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        templateName: c.template?.name || 'Custom Message',
        totalRecipients: c.totalRecipients || c._count.recipients,
        sentCount: c.sentCount,
        deliveredCount: Math.max(c.deliveredCount, c.sentCount),
        createdAt: c.createdAt,
      })),
      recentActivity: activityItems,
    };
  }
}
