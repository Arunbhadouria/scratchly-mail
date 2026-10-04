import { PrismaClient } from '@prisma/client';
import { workerConfig } from './config/env.js';
import { DryRunEmailProvider } from './providers/dry-run.provider.js';
import { SESEmailProvider } from './providers/ses.provider.js';
import { IEmailProvider } from './providers/email-provider.interface.js';

const prisma = new PrismaClient();

export class CampaignDeliveryWorker {
  private isRunning = false;
  private workerId = `worker-${process.pid}-${Math.random().toString(36).substring(2, 6)}`;
  private dryRunProvider = new DryRunEmailProvider();
  private sesProvider: IEmailProvider | null = null;

  constructor() {
    if (workerConfig.AWS_ACCESS_KEY_ID && workerConfig.AWS_SECRET_ACCESS_KEY) {
      try {
        this.sesProvider = new SESEmailProvider();
        console.log(`📡 [SES] Amazon SES provider initialized for region: ${workerConfig.AWS_REGION}`);
      } catch (e: any) {
        console.warn('⚠️ AWS SES client failed to initialize, falling back to DryRun:', e.message);
      }
    }
  }

  public async start() {
    this.isRunning = true;
    console.log(`👷 [${this.workerId}] Campaign Delivery Worker started.`);
    console.log(`📦 Configured Mode: ${workerConfig.CAMPAIGN_SENDING_MODE} | SES Ready: ${this.sesProvider ? 'YES (' + workerConfig.AWS_REGION + ')' : 'NO'}`);
    console.log(`⏱️  Polling Interval: ${workerConfig.QUEUE_POLL_INTERVAL_MS}ms, Batch Size: ${workerConfig.QUEUE_BATCH_SIZE}`);

    this.pollLoop();
  }

  public stop() {
    this.isRunning = false;
    console.log(`🛑 [${this.workerId}] Campaign Delivery Worker stopping...`);
  }

  private async pollLoop() {
    while (this.isRunning) {
      try {
        await this.processNextBatch();
      } catch (err: any) {
        console.error(`[Worker Error] Processing batch failed:`, err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, workerConfig.QUEUE_POLL_INTERVAL_MS));
    }
  }

  private async processNextBatch() {
    const now = new Date();
    const staleLockThreshold = new Date(now.getTime() - workerConfig.QUEUE_LOCK_TIMEOUT_SEC * 1000);

    // Release any stale locks from dead workers
    await prisma.queueJob.updateMany({
      where: {
        status: 'PROCESSING',
        lockedAt: { lt: staleLockThreshold },
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
        lockedBy: null,
      },
    });

    // Claim a batch of pending jobs
    const jobs = await prisma.$transaction(async (tx) => {
      // Find candidate jobs
      const candidates = await tx.queueJob.findMany({
        where: {
          status: 'PENDING',
          runAt: { lte: now },
        },
        orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        take: workerConfig.QUEUE_BATCH_SIZE,
      });

      if (candidates.length === 0) {
        return [];
      }

      const jobIds = candidates.map((c) => c.id);

      // Lock them
      await tx.queueJob.updateMany({
        where: { id: { in: jobIds } },
        data: {
          status: 'PROCESSING',
          lockedAt: now,
          lockedBy: this.workerId,
        },
      });

      return candidates;
    });

    if (jobs.length === 0) {
      return;
    }

    console.log(`[Worker] Claimed ${jobs.length} delivery jobs.`);

    for (const job of jobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: any) {
    const payload = job.payload as {
      campaignId: string;
      recipientId: string;
      email: string;
      provider?: string;
    };

    if (!payload?.recipientId || !payload?.campaignId) {
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: 'Malformed job payload' },
      });
      return;
    }

    try {
      // Check if campaign is paused or cancelled
      const campaign = await prisma.campaign.findUnique({
        where: { id: payload.campaignId },
      });

      if (!campaign || campaign.status === 'PAUSED' || campaign.status === 'CANCELLED') {
        // Leave job as pending so it can resume later, or delete if cancelled
        if (campaign?.status === 'CANCELLED') {
          await prisma.queueJob.delete({ where: { id: job.id } });
        } else {
          // If paused, release lock and postpone 5 seconds
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'PENDING',
              lockedAt: null,
              lockedBy: null,
              runAt: new Date(Date.now() + 5000),
            },
          });
        }
        return;
      }

      // Fetch recipient details
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: payload.recipientId },
      });

      if (!recipient) {
        await prisma.queueJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', lastError: 'Recipient record not found' },
        });
        return;
      }

      // Check if recipient is already sent, cancelled, or suppressed
      if (['SENT', 'ACCEPTED', 'DELIVERED', 'CANCELLED', 'SUPPRESSED'].includes(recipient.status)) {
        await prisma.queueJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        });
        return;
      }

      // Mark recipient as SENDING
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENDING' },
      });

      // Select provider
      const useSES = payload.provider === 'SES_BULK' && this.sesProvider !== null;
      const provider: IEmailProvider = useSES ? this.sesProvider! : this.dryRunProvider;

      console.log(`[Worker] Delivering to ${recipient.email} via ${useSES ? 'Amazon SES (' + workerConfig.AWS_REGION + ')' : 'Dry-Run simulation'}...`);

      // Deliver message
      const result = await provider.send({
        to: recipient.email,
        subject: recipient.personalizedSubject,
        html: recipient.personalizedHtml,
        text: recipient.personalizedText || undefined,
        campaignId: payload.campaignId,
        recipientId: recipient.id,
      });

      console.log(`[Worker] ✅ Delivered to ${recipient.email} via ${useSES ? 'Amazon SES (MessageId: ' + result.providerMessageId + ')' : 'Dry-Run'}`);

      // Mark recipient and job completed
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'DELIVERED',
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        }),
        prisma.emailEvent.create({
          data: {
            tenantId: recipient.tenantId,
            campaignId: payload.campaignId,
            recipientId: recipient.id,
            eventType: 'DELIVERED',
            providerMessageId: result.providerMessageId,
            eventData: result.rawResponse || {},
          },
        }),
        prisma.campaign.update({
          where: { id: payload.campaignId },
          data: {
            sentCount: { increment: 1 },
            deliveredCount: { increment: 1 },
          },
        }),
        prisma.queueJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        }),
      ]);

      // Check if campaign is now complete
      const pendingJobsCount = await prisma.queueJob.count({
        where: {
          payload: { path: ['campaignId'], equals: payload.campaignId },
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (pendingJobsCount === 0) {
        await prisma.campaign.update({
          where: { id: payload.campaignId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        console.log(`🎉 Campaign [${payload.campaignId}] completed all deliveries!`);
      }
    } catch (err: any) {
      console.error(`[Worker] Error delivering job ${job.id}:`, err.message);

      const nextAttempt = job.attempts + 1;
      const isFailedPermanently = nextAttempt >= job.maxAttempts;

      if (isFailedPermanently) {
        await prisma.$transaction([
          prisma.queueJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', lastError: err.message, attempts: nextAttempt },
          }),
          prisma.campaignRecipient.update({
            where: { id: payload.recipientId },
            data: { status: 'FAILED', lastError: err.message },
          }),
          prisma.campaign.update({
            where: { id: payload.campaignId },
            data: { failedCount: { increment: 1 } },
          }),
        ]);
      } else {
        // Exponential backoff: 2^attempt * 5 seconds
        const delaySeconds = Math.pow(2, nextAttempt) * 5;
        const nextRunAt = new Date(Date.now() + delaySeconds * 1000);

        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            attempts: nextAttempt,
            lastError: err.message,
            runAt: nextRunAt,
            lockedAt: null,
            lockedBy: null,
          },
        });
      }
    }
  }
}
