import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { IEmailProvider, EmailDeliveryMessage, EmailDeliveryResult } from './email-provider.interface.js';
import { workerConfig } from '../config/env.js';

export class SESEmailProvider implements IEmailProvider {
  private client: SESClient;

  constructor() {
    this.client = new SESClient({
      region: workerConfig.AWS_REGION,
      credentials: {
        accessKeyId: workerConfig.AWS_ACCESS_KEY_ID,
        secretAccessKey: workerConfig.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    const fromAddress = message.from || workerConfig.AWS_SES_FROM_EMAIL;

    const command = new SendEmailCommand({
      Source: fromAddress,
      Destination: {
        ToAddresses: [message.to],
      },
      Message: {
        Subject: {
          Data: message.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: message.html,
            Charset: 'UTF-8',
          },
          ...(message.text && {
            Text: {
              Data: message.text,
              Charset: 'UTF-8',
            },
          }),
        },
      },
      ...(workerConfig.AWS_SES_CONFIGURATION_SET && {
        ConfigurationSetName: workerConfig.AWS_SES_CONFIGURATION_SET,
      }),
    });

    const response = await this.client.send(command);

    if (!response.MessageId) {
      throw new Error('SES did not return a MessageId');
    }

    return {
      providerMessageId: response.MessageId,
      accepted: true,
      rawResponse: response,
    };
  }
}
