# Scratchly Mail

> Production-oriented, minimum-cost email management platform built for future integration with [Scratchly CRM](https://www.scratchlycrm.app/).

---

## Key Features

- **Personal Mailbox Integration via Gmail API**:
  - Secure Google OAuth 2.0 authorization code flow.
  - Refresh tokens encrypted at rest via AES-256-GCM.
  - View threads, inspect messages, compose, reply, and draft.
  - Never routes bulk campaigns through personal Gmail quotas.
- **Bulk Outreach Campaign Engine (Amazon SES + Dry-Run)**:
  - 2,000+ recipient batches with zero server timeouts.
  - Transactional database-backed queue using PostgreSQL `FOR UPDATE SKIP LOCKED`.
  - Rate limiting, exponential backoff, and idempotent sending.
  - Pause, resume, and cancel capabilities.
  - Automatic suppression of hard bounces and spam complaints.
  - Safe default dry-run mode for zero-cost local testing.
- **Contact & List Management**:
  - Multi-tenant data isolation.
  - CSV import with automatic column detection and duplicate handling.
  - Consent tracking and suppression enforcement.
  - External Scratchly CRM ID mapping fields.
- **Google Workspace Gmail Add-on**:
  - Contextual trigger card rendering inside Gmail.
  - Instant contact lookup, interaction history, and CRM quick actions.
- **Modern Responsive Dashboard**:
  - React 18, TypeScript, Vite, Tailwind CSS, Lucide icons.
  - Accessible, rich aesthetics, dark/light modes, live analytics.

---

## Monorepo Layout

```
scratchly-mail/
├── apps/
│   ├── web/                    # React 18 frontend dashboard
│   ├── api/                    # Express REST API
│   ├── worker/                 # Standalone campaign delivery queue worker
│   └── gmail-integration/      # Google Workspace Add-on manifest and cards
├── packages/
│   └── shared/                 # Zod validation schemas, DTOs & TypeScript types
├── prisma/
│   ├── schema.prisma           # Prisma PostgreSQL schema
│   └── seed.ts                 # Database seeder
├── docs/
│   ├── architecture.md         # System architecture & boundary contracts
│   ├── implementation-plan.md  # Phase-by-phase roadmap
│   └── oauth-setup.md          # Google Cloud & Amazon SES configuration guide
├── docker-compose.yml          # Local PostgreSQL persistence container
├── .env.example                # Environment variables template
└── README.md
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested on v24.17.0)
- **pnpm**: v9+ (or npm)
- **Docker**: For local PostgreSQL (or existing local PostgreSQL 14+)

### 2. Start PostgreSQL
```bash
docker compose up -d
```
*Runs PostgreSQL 16 on port 5433 with database `scratchly_mail`.*

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Environment & Database
```bash
cp .env.example .env
pnpm db:push
pnpm db:seed
```

### 5. Launch Development Services
```bash
# Starts API (port 4000), Worker, and Web UI (port 5173) concurrently:
pnpm dev
```

Visit [http://localhost:5173](http://localhost:5173) to access the dashboard.
