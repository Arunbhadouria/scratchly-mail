# Scratchly Mail — Architecture & Technical Specifications

## 1. Executive Summary & Vision

**Scratchly Mail** is an independent, production-oriented email management and outreach platform built with a multi-tenant foundation. It is designed to provide:
1. **Gmail Mailbox Integration**: Secure OAuth 2.0 authorization for single-user mailbox reading, thread inspection, drafting, sending, and contextual CRM card lookups (via Google Workspace Add-on).
2. **High-Throughput Bulk Campaign Delivery Engine**: Purpose-built for 2,000+ recipients per campaign, completely decoupled from Gmail sending limits, backed by Amazon SES (with an extensible provider adapter) and safe default dry-run execution.
3. **Robust Contact & Suppression Management**: Multi-tenant contacts, CSV imports with validation, deduplication, consent tracking, unsubscribe enforcement, and bounce/complaint suppression lists.
4. **Clean Scratchly CRM API Boundary**: Defined contracts and mapped IDs allowing future integration with [Scratchly CRM](https://www.scratchlycrm.app/) without code rewrites or schema changes.
5. **Cost-Effective Infrastructure**: Minimal local and cloud footprint using PostgreSQL-backed transactional queuing, zero required paid third-party AI APIs, and modular swappability for Redis/BullMQ.

---

## 2. High-Level System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer [Client & User Interface Layer]
        WebApp["Web App (React + Vite + Tailwind)"]
        GmailAddon["Google Workspace Add-on (Gmail Contextual Trigger)"]
    end

    subgraph APILayer [API Gateway & Backend (apps/api)]
        ExpressApp["Express.js REST API"]
        AuthModule["OAuth 2.0 & Session Auth"]
        ContactModule["Contact & Suppression Service"]
        CampaignModule["Campaign Orchestrator"]
        GmailService["Gmail API Mailbox Client"]
        WebhookReceiver["SES / Provider Webhook Receiver"]
    end

    subgraph WorkerLayer [Background Execution Engine (apps/worker)]
        QueueProcessor["Queue Worker (DB-backed / Transactional Locks)"]
        RateLimiter["Adaptive Rate Limiter & Token Bucket"]
        SESAdapter["SES Provider Client"]
        DryRunAdapter["Dry-Run Provider Client"]
    end

    subgraph DataLayer [Persistence & Multi-Tenant Data Store]
        PostgreSQL[("PostgreSQL 16 Multi-Tenant DB")]
        QueueTable[("Queue Jobs Table")]
        EncryptedVault["AES-256-GCM Encrypted Token Store"]
    end

    subgraph ExternalServices [External Integrations]
        GoogleCloud["Google Cloud / Gmail API"]
        AmazonSES["Amazon Simple Email Service (SES)"]
        ScratchlyCRM["Scratchly CRM (Future Integration Boundary)"]
    end

    WebApp -->|REST + Bearer / Cookie| ExpressApp
    GmailAddon -->|Add-on Action Endpoints| ExpressApp

    ExpressApp --> AuthModule
    ExpressApp --> ContactModule
    ExpressApp --> CampaignModule
    ExpressApp --> GmailService
    ExpressApp --> WebhookReceiver

    CampaignModule -->|Enqueue Recipients| QueueTable
    QueueProcessor -->|Claim Jobs with FOR UPDATE SKIP LOCKED| QueueTable
    QueueProcessor --> RateLimiter
    RateLimiter --> SESAdapter
    RateLimiter --> DryRunAdapter

    SESAdapter -->|Bulk Send API| AmazonSES
    AmazonSES -->|Delivery / Bounce / Complaint SNS Webhooks| WebhookReceiver
    GmailService -->|User-Authorized REST API| GoogleCloud
    WebhookReceiver -->|Record Event & Suppress| PostgreSQL

    ExpressApp --> PostgreSQL
    AuthModule --> EncryptedVault
    CampaignModule --> ScratchlyCRM
```

---

## 3. Monorepo Organization & Component Boundaries

The project uses a pnpm monorepo layout:

```
scratchly-mail/
├── apps/
│   ├── web/                    # React 18 / Vite / Tailwind / Lucide Dashboard
│   ├── api/                    # Express REST API, Controllers, Middleware, Auth
│   ├── worker/                 # Standalone Job Queue Worker daemon
│   └── gmail-integration/      # Google Workspace Add-on manifests & card builders
├── packages/
│   └── shared/                 # Shared Zod schemas, TypeScript types, DTOs, constants
├── prisma/
│   ├── schema.prisma           # Multi-tenant schema definition
│   ├── migrations/             # Versioned SQL migrations
│   └── seed.ts                 # Local development & test seeder
├── docs/
│   ├── architecture.md         # This specification document
│   ├── implementation-plan.md  # Detailed phase breakdown & milestones
│   ├── oauth-setup.md          # Google Cloud Console & Workspace Add-on setup guide
│   └── deployment.md           # Production deployment & infrastructure guide
├── docker-compose.yml          # Local PostgreSQL persistence container
├── .env.example                # Sanitized environment template
└── README.md                   # Quickstart instructions
```

### Module Responsibilities & Boundary Enforcement
1. **`apps/web`**: Contains the frontend SPA. Never stores secrets or performs direct database or third-party API calls. Interacts strictly through `apps/api`.
2. **`apps/api`**: Exposes secure REST endpoints. Performs request validation via Zod schemas from `@scratchly/shared`, authenticates users, enforces tenant isolation, schedules jobs in the database queue, and serves webhook handlers.
3. **`apps/worker`**: Runs in an isolated OS process (can be scaled independently). Polls the DB queue for pending recipient delivery jobs, respects per-provider rate limits, dispatches batches, handles retries with exponential backoff, and updates campaign aggregate counters.
4. **`apps/gmail-integration`**: Google Workspace Add-on configuration (`appsscript.json`), Apps Script contextual trigger handlers, and backend card render endpoints. Operates using standard Workspace Add-on CardService specifications.
5. **`packages/shared`**: Contains common schemas (contacts, campaigns, templates, pagination) and types used by both frontend and backend. Prevents drift between UI forms and API endpoints.

---

## 4. Separation of Mailbox Operations vs. Bulk Campaign Delivery

A core architectural principle of Scratchly Mail is **complete physical and operational separation between personal Gmail operations and bulk campaign delivery**:

| Attribute | Personal Mailbox Operations | Bulk Campaign Outreach |
| :--- | :--- | :--- |
| **Provider** | Gmail API (Google Workspace / Consumer Gmail) | Amazon SES (or Dry-Run during dev) |
| **Authentication** | User's Google OAuth 2.0 (Refresh Token) | Server AWS IAM Credentials |
| **Volume & Limits** | Low volume (individual replies, 1-on-1 conversations, drafts). Strictly bound to Google's 500–2,000 recipient/day mailbox quotas. | High volume (2,000+ recipients per campaign, tens of thousands per day). AWS SES quota-based. |
| **Reputation Impact** | Direct impact on user's primary domain and Google Workspace account standing. | Isolated sending domain, dedicated DKIM/SPF/DMARC, configuration sets, and bounce reputation metrics. |
| **Execution Flow** | Synchronous HTTP calls via API server. | Asynchronous queue-based batching via standalone worker. |
| **Rule Enforcement** | **Never bypass bulk sending through Gmail API.** Bulk campaigns are prohibited from routing through user Gmail accounts. |

---

## 5. Security & Privacy Architecture

### 5.1 Credential & Token Encryption at Rest
- Sensitive tokens (`encryptedAccessToken`, `encryptedRefreshToken` in `EmailConnection`) are encrypted using **AES-256-GCM**.
- Key management: A 256-bit key (`ENCRYPTION_KEY`) is injected via environment variables.
- Each encrypted payload includes:
  - 12-byte initialization vector (`iv`)
  - 16-byte authentication tag (`tag`)
  - Ciphertext
- Stored format: `iv:tag:ciphertext` (hex encoded). Plaintext secrets are never stored or logged.

### 5.2 Multi-Tenant Isolation
- Every core entity contains `tenantId`.
- API endpoints enforce tenant ownership at the database query level (e.g., `WHERE tenantId = req.user.tenantId`).
- Cross-tenant access attempts are rejected with HTTP 403 / 404 without leaking resource existence.

### 5.3 Safe Template Rendering & XSS Prevention
- Dynamic recipient placeholders (e.g. `{{first_name}}`, `{{company}}`, `{{email}}`) are escaped using strict entity encoding.
- Script injection attacks (`<script>`, `javascript:`, inline event handlers `onload=`) are sanitized or prohibited in template bodies.
- Safe previews are rendered inside sandboxed iframes (`sandbox="allow-same-origin"`).

### 5.4 Idempotency & Duplicate Prevention
- Each campaign recipient delivery has an `idempotencyKey` computed from `hash(campaignId + recipientId + email)`.
- If a worker crashes mid-batch, database locks expire and jobs are re-evaluated; existing provider message IDs prevent double sends.

### 5.5 Gmail OAuth 2.0 & Mailbox Integration Architecture
- **Server-Side Authorization Code Flow**:
  - `GET /api/integrations/gmail/connect`: Issues authorization URL with offline access (`access_type: 'offline'`, `prompt: 'consent'`).
  - **CSRF State Protection**: State is an HMAC-SHA256 signed payload containing `tenantId`, `userId`, `nonce`, and a 15-minute expiration timestamp. Tampered or expired state payloads are rejected before token exchange.
  - `GET /api/integrations/gmail/callback`: Validates state signature and tenant binding, exchanges authorization code for tokens, retrieves user profile (`gmail.users.getProfile`), and updates or creates an `EmailConnection`.
- **Encrypted Token Management**:
  - Refresh tokens are encrypted at rest using AES-256-GCM (`iv:tag:ciphertext`).
  - Access tokens are never stored long-term; they are maintained in-memory or acquired on-demand using the encrypted refresh token.
  - Client secrets, refresh tokens, and access tokens are never returned over API responses, displayed in the frontend, or logged into audit trails.
- **Gmail Service Abstraction (`GmailService`)**:
  - Centralizes all Google API operations (`listMessages`, `getMessage`, `getThread`, `createDraft`, `sendIndividualEmail`, `replyToThread`).
  - Attaches `oauth2Client.on('tokens')` listener to persist refreshed credentials transparently.
  - Categorizes Google errors into application codes: `GMAIL_NOT_CONFIGURED`, `GMAIL_NOT_CONNECTED`, `GMAIL_REAUTH_REQUIRED`, `GMAIL_PERMISSION_DENIED`, `GMAIL_RATE_LIMITED`, `GMAIL_API_ERROR`.
  - Sets connection status to `REAUTH_REQUIRED` if Google returns `invalid_grant` or revoked authorization.
- **Sender → CRM Contact Matching**:
  - Message details parse the sender's email address and query the local `Contact` table scoped to `tenantId`.
  - The UI indicates contact match status and provides a prefilled "+ Create Contact" action that integrates directly with the existing contact service.
- **Mailbox Actions**:
  - **Draft Creation**: Creates non-sent drafts in Gmail via `gmail.users.drafts.create`.
  - **Thread Reply**: Retrieves parent message metadata, sets `In-Reply-To`, `References`, and `threadId`, ensuring native conversation threading in Gmail.
  - **Explicit Individual Send**: Requires explicit two-step user review and confirmation. Bulk campaign sending through Gmail is strictly prohibited.
- **Safe Disconnection**:
  - `POST /api/integrations/gmail/disconnect`: Best-effort Google token revocation (`oauth2Client.revokeToken`), removes stored refresh token data, and sets connection status to `DISCONNECTED` without deleting local contacts or campaign history.


---

## 6. Job Queue Architecture (Database-Backed with BullMQ Transition Path)

To minimize infrastructure costs for initial deployments without requiring a paid Redis instance, Scratchly Mail implements a **PostgreSQL-backed transactional queue**:

```mermaid
sequenceDiagram
    autonumber
    participant API as apps/api
    participant DB as PostgreSQL (QueueJob table)
    participant Worker as apps/worker
    participant SES as Amazon SES / Dry-Run

    API->>DB: INSERT INTO "QueueJob" (type, payload, status='PENDING') in transaction
    Note over Worker: Worker poll loop (every N ms)
    Worker->>DB: UPDATE "QueueJob" SET status='PROCESSING', lockedAt=NOW(), lockedBy=workerId<br/>WHERE id IN (SELECT id FROM "QueueJob" WHERE status='PENDING' AND runAt <= NOW() ORDER BY priority, id LIMIT batch FOR UPDATE SKIP LOCKED) RETURNING *
    DB-->>Worker: Batch of locked jobs
    loop For each job
        Worker->>SES: Deliver email to recipient
        alt Successful Send
            SES-->>Worker: MessageId accepted
            Worker->>DB: UPDATE "QueueJob" SET status='COMPLETED';<br/>UPDATE "CampaignRecipient" SET status='ACCEPTED', providerMessageId=...
        else Rate Limited / Transient Error
            Worker->>DB: UPDATE "QueueJob" SET status='PENDING', runAt=NOW() + backoff, attempts = attempts + 1
        else Permanent Failure / Suppressed
            Worker->>DB: UPDATE "QueueJob" SET status='FAILED', lastError=...;<br/>UPDATE "CampaignRecipient" SET status='FAILED'
        end
    end
```

### Transition to Redis/BullMQ Interface
All queue operations are abstracted behind a clean interface:
```typescript
export interface IQueueService {
  enqueue(job: QueueJobDefinition): Promise<string>;
  enqueueBatch(jobs: QueueJobDefinition[]): Promise<string[]>;
  pauseQueue(queueName: string): Promise<void>;
  resumeQueue(queueName: string): Promise<void>;
  cancelJobs(filter: { campaignId: string }): Promise<number>;
}
```
Switching to Redis/BullMQ in the future requires swapping the `DatabaseQueueService` implementation for `BullMQQueueService` without changing any API handler or worker logic.

---

## 7. Delivery Outcomes & Webhook Processing

Amazon SES publishes real-time event notifications via AWS SNS to our webhook receiver:

1. **Queued**: Recipient is in the database queue awaiting dispatch.
2. **Sending**: Worker has locked the job and is calling the provider API.
3. **Accepted by Provider**: SES has received the email and assigned a `providerMessageId` (HTTP 200). Note: this is *not* delivery.
4. **Delivered**: SES SNS webhook indicates successful handshake with recipient MTA (`eventType: "Delivery"`).
5. **Bounced**: SES SNS webhook reports hard or soft bounce (`eventType: "Bounce"`). Hard bounces automatically insert an entry into the `Suppression` table.
6. **Complained**: Recipient clicked "Mark as Spam" (`eventType: "Complaint"`). Immediately inserts an entry into `Suppression` and marks contact status as `COMPLAINED`.
7. **Unsubscribed**: Recipient accessed unsubscribe link (`eventType: "Unsubscribe"`). Adds to `Suppression` and marks contact status as `UNSUBSCRIBED`.

---

## 8. Scratchly CRM Integration Boundary

Because Scratchly CRM source code and private APIs are not available, Scratchly Mail provides a strict integration facade:

```typescript
export interface IScratchlyCRMConnector {
  syncContact(contact: ContactDTO): Promise<ExternalSyncResult>;
  lookupContactByEmail(email: string): Promise<ExternalCRMContact | null>;
  recordActivity(activity: CRMActivityEvent): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
```

### Entity Mapping Architecture
- Local `Contact` table includes `externalScratchlyId` (indexed, nullable).
- Local `User` table includes `externalScratchlyUserId` (indexed, nullable).
- All webhooks between Scratchly CRM and Scratchly Mail use HMAC-SHA256 signature verification.
- When Scratchly CRM API details become available, only the connector implementation class will need updates.

---

## 9. Google Workspace Gmail Add-on Architecture

Rather than an insecure DOM scraper or generic Chrome Extension, Scratchly Mail integrates with Gmail via an official **Google Workspace Add-on**:

### Contextual Trigger Specification
- **Trigger**: `onGmailMessageOpen` / `onGmailThreadOpen`
- **Scopes**: `https://www.googleapis.com/auth/gmail.addons.execute`, `https://www.googleapis.com/auth/gmail.addons.current.message.readonly`
- **Action**:
  1. Add-on extracts message `messageId` and sender email.
  2. Add-on invokes Scratchly Mail backend endpoint: `GET /api/gmail-addon/context?email={senderEmail}`.
  3. API responds with contact details, recent campaign engagements, and CRM action card definitions.
  4. Google Apps Script renders the JSON card response into native Gmail UI.
  5. Action buttons (e.g. "Add to Contact List", "View in Scratchly Mail", "Add Note") execute authenticated backend callbacks.

---

## 10. Required External Configurations

### 10.1 Google Cloud Platform Setup
1. **GCP Project**: Create a new project in Google Cloud Console.
2. **Enable APIs**:
   - Gmail API (`gmail.googleapis.com`)
   - Google Workspace Add-ons API
3. **OAuth Consent Screen**:
   - User Type: External (or Internal if GSuite domain).
   - Scopes:
     - `openid`, `email`, `profile`
     - `https://www.googleapis.com/auth/gmail.readonly` (Read messages and threads)
     - `https://www.googleapis.com/auth/gmail.send` (Send individual emails)
     - `https://www.googleapis.com/auth/gmail.compose` (Create drafts)
4. **OAuth 2.0 Credentials**:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:4000/api/auth/google/callback` (Dev) and `https://api.yourdomain.com/api/auth/google/callback` (Prod).

### 10.2 Amazon Web Services (SES) Setup
1. **AWS IAM User / Role**: Create an IAM user with minimal policy `ses:SendEmail`, `ses:SendRawEmail`.
2. **Verified Domain / Email Identity**: Verify the sending domain (e.g. `mail.yourdomain.com`) in SES with DNS records (DKIM, SPF, MX).
3. **Production Access**: If new AWS account, submit SES production access request to exit Sandbox (200 emails/day sandbox limit).
4. **Configuration Set & SNS Topic**: Configure SNS topic for `Delivery`, `Bounce`, and `Complaint` notifications pointing to `https://api.yourdomain.com/api/webhooks/ses`.

---

## 11. Assumptions & Design Decisions

1. **Local Dev Without Cloud Costs**: Both Gmail and Amazon SES can run in dry-run/mock mode locally. Developers do not need active cloud accounts to test campaign creation, template rendering, recipient batching, rate limiting, and analytics.
2. **Tenant Model**: Multi-tenant by default. Even single-user accounts operate under an automatic personal tenant to preserve isolation and scaling headroom.
3. **Database Choice**: PostgreSQL 16 with standard relational tables, UUID primary keys, and JSONB for event payloads and custom fields.
4. **Styling & Accessibility**: Tailwind CSS with consistent UI component primitives, high contrast ratios, responsive flex/grid layouts, and zero overflow.
