import { IEmailProvider, EmailDeliveryMessage, EmailDeliveryResult } from './email-provider.interface.js';
import crypto from 'crypto';

export class DryRunEmailProvider implements IEmailProvider {
  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    // Simulate slight provider network latency (20ms - 50ms)
    await new Promise((resolve) => setTimeout(resolve, 25));

    const simulatedMessageId = `dryrun-${Date.now()}-${crypto.randomBytes(8).toString('hex')}@scratchly.local`;

    return {
      providerMessageId: simulatedMessageId,
      accepted: true,
      rawResponse: {
        provider: 'DRY_RUN',
        simulatedAt: new Date().toISOString(),
        to: message.to,
        subject: message.subject,
      },
    };
  }
}
