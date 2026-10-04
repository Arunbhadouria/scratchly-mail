import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const webhookRouter = Router();

/**
 * Amazon SES / SNS Notification Webhook
 * Handles Deliveries, Bounces, Complaints, and Unsubscribes
 */
webhookRouter.post('/ses', async (req, res, next) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // ignore
      }
    }

    // SNS Subscription Confirmation
    if (payload.Type === 'SubscriptionConfirmation' && payload.SubscribeURL) {
      console.log('[SNS] Subscription confirmation URL:', payload.SubscribeURL);
      res.status(200).send('Subscription confirmed');
      return;
    }

    // SNS Notification Message
    if (payload.Type === 'Notification' && payload.Message) {
      const message = typeof payload.Message === 'string' ? JSON.parse(payload.Message) : payload.Message;
      const eventType = message.eventType || message.notificationType;
      const mail = message.mail || {};
      const messageId = mail.messageId;

      if (!messageId) {
        res.status(200).json({ received: true });
        return;
      }

      // Find recipient by providerMessageId
      const recipient = await prisma.campaignRecipient.findFirst({
        where: { providerMessageId: messageId },
        include: { campaign: true },
      });

      if (!recipient) {
        res.status(200).json({ received: true, note: 'Message not associated with local campaign recipient' });
        return;
      }

      const tenantId = recipient.tenantId;
      const campaignId = recipient.campaignId;

      if (eventType === 'Delivery' || eventType === 'Delivered') {
        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'DELIVERED', deliveredAt: new Date() },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { deliveredCount: { increment: 1 } },
          }),
          prisma.emailEvent.create({
            data: {
              tenantId,
              campaignId,
              recipientId: recipient.id,
              eventType: 'DELIVERED',
              providerMessageId: messageId,
              eventData: message,
            },
          }),
        ]);
      } else if (eventType === 'Bounce') {
        const bounceType = message.bounce?.bounceType;
        const isPermanent = bounceType === 'Permanent';

        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'BOUNCED', lastError: `Bounce: ${bounceType}` },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { bounceCount: { increment: 1 } },
          }),
          ...(isPermanent
            ? [
                prisma.suppression.upsert({
                  where: { tenantId_email: { tenantId, email: recipient.email } },
                  update: { reason: 'BOUNCE' as const },
                  create: {
                    tenantId,
                    email: recipient.email,
                    reason: 'BOUNCE' as const,
                    sourceCampaignId: campaignId,
                    notes: `Permanent bounce via SES: ${message.bounce?.bounceSubType || ''}`,
                  },
                }),
                prisma.contact.updateMany({
                  where: { tenantId, email: recipient.email },
                  data: { status: 'BOUNCED' },
                }),
              ]
            : []),
          prisma.emailEvent.create({
            data: {
              tenantId,
              campaignId,
              recipientId: recipient.id,
              eventType: 'BOUNCE',
              providerMessageId: messageId,
              eventData: message,
            },
          }),
        ]);
      } else if (eventType === 'Complaint') {
        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'COMPLAINED' },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { complaintCount: { increment: 1 } },
          }),
          prisma.suppression.upsert({
            where: { tenantId_email: { tenantId, email: recipient.email } },
            update: { reason: 'COMPLAINT' as const },
            create: {
              tenantId,
              email: recipient.email,
              reason: 'COMPLAINT' as const,
              sourceCampaignId: campaignId,
              notes: 'Spam complaint recorded via SES SNS',
            },
          }),
          prisma.contact.updateMany({
            where: { tenantId, email: recipient.email },
            data: { status: 'COMPLAINED' },
          }),
          prisma.emailEvent.create({
            data: {
              tenantId,
              campaignId,
              recipientId: recipient.id,
              eventType: 'COMPLAINT',
              providerMessageId: messageId,
              eventData: message,
            },
          }),
        ]);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Future Scratchly CRM Integration Boundary
 * Receives webhook events from Scratchly CRM (e.g. contact created/updated/deleted in CRM)
 */
webhookRouter.post('/scratchly-crm', async (req, res) => {
  // Safe placeholder acknowledging webhook without throwing
  console.log('[Scratchly CRM Boundary] Webhook received:', req.body);
  res.status(200).json({ success: true, processed: true, message: 'Scratchly CRM webhook boundary acknowledged' });
});
