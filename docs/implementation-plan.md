# Scratchly Mail — Implementation Plan & Phase Roadmap

This document outlines the systematic, phased implementation strategy for building Scratchly Mail in accordance with the project specifications.

---

## Phase Breakdown

### Phase 1 — Inspect and Plan (Current Phase)
- [x] Inspect existing workspace environment and dependencies.
- [x] Validate local tooling (Node v24, npm v12, pnpm v10, Docker, Git).
- [x] Set up local isolated PostgreSQL container (port 5433) and verify database health.
- [x] Author comprehensive system architecture document (`docs/architecture.md`).
- [x] Author implementation plan and milestone tracker (`docs/implementation-plan.md`).
- [x] Author Google OAuth and AWS SES setup documentation (`docs/oauth-setup.md`).
- [x] Formulate initial Prisma database schema (`prisma/schema.prisma`) with all required entities.
- [x] Configure monorepo structure (`pnpm-workspace.yaml`, root `package.json`, `.gitignore`, `.env.example`, `.env`).

---

### Phase 2 — Build the Foundation (Completed & Verified)
- [x] Initialize packages and apps:
  - `packages/shared`: Common types, Zod schemas, error definitions, template engine.
  - `apps/api`: Express, TypeScript, Zod validation middleware, JWT auth, AES-256-GCM token encryption utils, Prisma client, health checks, centralized error handling.
  - `apps/web`: Vite + React + TypeScript + Tailwind CSS application shell, sidebar navigation, breadcrumbs, responsive layout, dark theme foundation.
- [x] Apply Prisma migrations to local PostgreSQL (Docker container on port 5433).
- [x] Implement database seed script (`prisma/seed.ts`) with demo tenant, default user, sample contacts, and pre-built templates.
- [x] Set up Vitest testing harness and write automated unit tests for:
  - Token encryption / decryption round-trip (AES-256-GCM with auth tag validation).
  - Template variable substitution and script sanitization.
  - Zod request validations.
  - Health check endpoint (`/health`).

---

### Phase 3 — Build Core Email Functionality (Completed & Verified)
- [x] **Contacts Management**:
  - Contact CRUD endpoints (Create, List with pagination/search/filtering, Edit, Delete).
  - CSV file parser with auto-column detection and mapping (first name, last name, email, company, phone).
  - Deduplication and RFC 5322 email validation.
  - Suppression & unsubscribe checks before saving or targeting.
- [x] **Email Templates**:
  - Template CRUD (Subject, HTML body, Plain-text body, Preview text).
  - Placeholder substitution engine (`{{first_name}}`, `{{company}}`, `{{email}}`, etc.).
  - Interactive HTML preview with variable test data.
  - Test email preview rendering.
- [x] **Bulk Campaign Engine**:
  - Campaign wizard (Setup -> Contact Selection -> Template -> Personalized Preview -> Exclusions & Suppressions Review -> Launch/Schedule).
  - Recipient calculation with automatic deduplication and suppression filtering.
  - Database-backed Job Queue worker (`apps/worker`) with `FOR UPDATE SKIP LOCKED` transactional semantics.
  - Safe default Dry-Run delivery mode.
  - Pause, resume, and cancel capabilities.
  - Persistent per-recipient status tracking (`QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `BOUNCED`, `FAILED`).
- [x] **Analytics & Delivery Reporting**:
  - Real database-driven metrics (Total, Sent, Delivered, Bounces, Complaints, Unsubscribes).
  - No fabricated metrics; distinct states for provider acceptance vs. verified delivery.

---

### Phase 4 — Add Integrations (Gmail Integration Completed & Verified)
- [x] **Gmail Mailbox Integration**:
  - Google OAuth 2.0 authorization code flow (`GET /api/integrations/gmail/connect`, `GET /api/integrations/gmail/callback`).
  - Cryptographically secure OAuth state with HMAC-SHA256 signature, 15-minute expiration, and session binding.
  - Encrypted credential storage at rest using AES-256-GCM (`encryptedRefreshToken`), zero token exposure to browser.
  - Centralized `GmailService` abstraction using official `@googleapis/gmail`:
    - User profile and connection status (`GET /api/integrations/gmail/status`).
    - Fetching recent inbox messages and search (`GET /api/integrations/gmail/messages`).
    - Fetching single message details with sanitized HTML and safe plain text fallback (`GET /api/integrations/gmail/messages/:id`).
    - Fetching thread history (`GET /api/integrations/gmail/threads/:id`).
    - Sender-to-Contact matching against local CRM DB with prefilled `[+ Create Contact]` action.
    - Creating drafts in Gmail (`POST /api/integrations/gmail/drafts`).
    - Replying to threads (`POST /api/integrations/gmail/reply`) with RFC `In-Reply-To` and `References` threading headers.
    - Explicit individual send (`POST /api/integrations/gmail/send`) with two-step confirmation modal.
    - Safe disconnect with Google token revocation (`POST /api/integrations/gmail/disconnect`).
    - Reconnection detection and `REAUTH_REQUIRED` state handling for `invalid_grant`.
- [ ] **Amazon SES Provider Adapter & Production Webhooks**:
  - SES client adapter implementing the common `IEmailProvider` interface (dry-run & sandbox verified).
  - Rate-limited batch sending.
  - Production SNS webhook endpoint (`/api/webhooks/ses`) for real delivery, bounce, and complaint processing.
  - Automatic suppression list insertion upon hard bounce or spam complaint.

---

### Phase 5 — Add Gmail UI Integration (Google Workspace Add-on)
- [ ] Workspace Add-on manifest (`appsscript.json`) targeting Gmail contextual triggers (`onGmailMessageOpen`).
- [ ] Apps Script card builder rendering native Gmail side panels:
  - Sender identification and contact lookup in Scratchly Mail.
  - Quick action to create or edit contact in CRM.
  - Display recent email history and campaign interactions.
  - Deep-link button to open full Scratchly Mail dashboard.
- [ ] Backend contextual endpoints (`/api/gmail-addon/context`, `/api/gmail-addon/actions`).

---

### Phase 6 — Test, Polish & Deployment Preparation
- [ ] End-to-end integration tests (Supertest for API endpoints, Vitest for services).
- [ ] Verify security boundaries: tenant isolation, invalid token handling, rate limiting.
- [ ] Stress-test queue worker with 2,000+ mock recipients to verify memory stability and lock release.
- [ ] Finalize production deployment documentation (`docs/deployment.md`).
- [ ] Verification report and demonstration.
