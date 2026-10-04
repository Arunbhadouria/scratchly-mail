import { z } from 'zod';

// =============================================================================
// Common Types & Utilities
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// =============================================================================
// Authentication & User
// =============================================================================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required'),
  tenantName: z.string().min(1, 'Workspace name is required').default('Default Workspace'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tenantId: string;
  tenantName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

// =============================================================================
// Contacts & Suppression
// =============================================================================

export const ContactCreateSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.string().trim().max(100).optional().default('manual'),
  consentProof: z.string().trim().max(500).optional().nullable(),
  consentGiven: z.boolean().default(true),
  externalScratchlyId: z.string().optional().nullable(),
  customFields: z.record(z.any()).optional().default({}),
});

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;

export const ContactUpdateSchema = ContactCreateSchema.partial();
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;

export const ContactQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED']).optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  eligibility: z.enum(['all', 'eligible', 'suppressed']).optional(),
});

export type ContactQuery = z.infer<typeof ContactQuerySchema>;

export const ContactSuppressSchema = z.object({
  reason: z.enum(['UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'MANUAL']).default('MANUAL'),
  notes: z.string().max(500).optional(),
});

export type ContactSuppressInput = z.infer<typeof ContactSuppressSchema>;

export const CampaignRecipientsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum([
    'QUEUED',
    'SENDING',
    'SENT',
    'ACCEPTED',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINED',
    'FAILED',
    'UNSUBSCRIBED',
    'CANCELLED',
    'SUPPRESSED',
  ]).optional(),
});

export type CampaignRecipientsQuery = z.infer<typeof CampaignRecipientsQuerySchema>;

export const CSVImportSchema = z.object({
  contacts: z.array(ContactCreateSchema).min(1, 'At least one contact must be provided').max(5000, 'Batch size exceeds 5000 limit'),
  defaultSource: z.string().default('csv_import'),
});

export type CSVImportInput = z.infer<typeof CSVImportSchema>;

// =============================================================================
// Email Templates
// =============================================================================

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(150),
  subject: z.string().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().min(1, 'HTML body is required'),
  bodyText: z.string().optional().nullable(),
  previewText: z.string().max(300).optional().nullable(),
});

export type TemplateCreateInput = z.infer<typeof TemplateCreateSchema>;

export const TemplateUpdateSchema = TemplateCreateSchema.partial();
export type TemplateUpdateInput = z.infer<typeof TemplateUpdateSchema>;

export const TemplatePreviewSchema = z.object({
  subject: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string().optional().nullable(),
  sampleData: z.record(z.string()).default({
    first_name: 'Alex',
    last_name: 'Rivera',
    email: 'alex@example.com',
    company: 'Acme Growth Labs',
  }),
});

export type TemplatePreviewInput = z.infer<typeof TemplatePreviewSchema>;

// =============================================================================
// Bulk Campaigns
// =============================================================================

export const CampaignCreateSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(150),
  subject: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().max(300).optional().nullable()
  ),
  templateId: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid().optional().nullable()
  ),
  bodyHtml: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  provider: z.enum(['SES_BULK', 'DRY_RUN']).default('DRY_RUN'),
  scheduledAt: z.string().datetime().optional().nullable(),
  contactFilter: z.object({
    status: z.enum(['ACTIVE']).default('ACTIVE'),
    tags: z.array(z.string()).optional(),
    company: z.string().optional(),
    specificContactIds: z.array(z.string().uuid()).optional(),
  }).optional(),
});

export type CampaignCreateInput = z.infer<typeof CampaignCreateSchema>;

export const CampaignUpdateSchema = CampaignCreateSchema.partial();
export type CampaignUpdateInput = z.infer<typeof CampaignUpdateSchema>;

export const CampaignLaunchSchema = z.object({
  confirmRecipientCount: z.number().int().min(0).default(0),
  dryRun: z.boolean().default(false),
});

export type CampaignLaunchInput = z.infer<typeof CampaignLaunchSchema>;

// =============================================================================
// Gmail Mailbox API Operations
// =============================================================================

export const SendGmailMessageSchema = z.object({
  to: z.string().email(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  subject: z.string().min(1),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
});

export type SendGmailMessageInput = z.infer<typeof SendGmailMessageSchema>;

export const CreateGmailDraftSchema = SendGmailMessageSchema.partial({
  to: true,
  subject: true,
});

export type CreateGmailDraftInput = z.infer<typeof CreateGmailDraftSchema>;

export const ReplyGmailMessageSchema = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  to: z.string().email('Recipient email is required'),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
});

export type ReplyGmailMessageInput = z.infer<typeof ReplyGmailMessageSchema>;

// =============================================================================
// Template Substitution & Sanitization Engine
// =============================================================================

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeHtmlContent(html: string): string {
  // Disallow executable script tags and risky javascript URI protocols
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, 'blocked-protocol:')
    .replace(/\bon\w+\s*=/gi, 'data-forbidden=');
}

export function renderTemplatePlaceholders(
  templateString: string,
  variables: Record<string, any>,
  options: { escapeValues?: boolean } = { escapeValues: true }
): string {
  if (!templateString) return '';

  return templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const rawVal = variables[key];
    if (rawVal === undefined || rawVal === null) {
      return '';
    }
    const strVal = String(rawVal);
    return options.escapeValues ? escapeHtml(strVal) : strVal;
  });
}
