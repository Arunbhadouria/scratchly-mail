export interface EmailDeliveryMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  campaignId: string;
  recipientId: string;
}

export interface EmailDeliveryResult {
  providerMessageId: string;
  accepted: boolean;
  rawResponse?: any;
}

export interface IEmailProvider {
  send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>;
}
