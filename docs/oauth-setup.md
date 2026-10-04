# Google Cloud OAuth 2.0 & Amazon SES Setup Guide

This document describes the exact steps and configurations required to configure Google OAuth 2.0 (for personal Gmail mailbox operations) and Amazon SES (for bulk campaigns) in **Scratchly Mail**.

---

## 1. Google Cloud Console (OAuth 2.0 & Gmail API)

### Step 1.1: Create Project & Enable APIs
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Scratchly Mail` (or select an existing project).
3. Navigate to **APIs & Services > Library**.
4. Search for and enable:
   - **Gmail API** (`gmail.googleapis.com`)
   - **Google People API** (optional, for profile resolution)

### Step 1.2: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **User Type**:
   - **Internal** (Recommended if using a Google Workspace organization; allows immediate internal testing without verification).
   - **External** (For testing with general `@gmail.com` accounts. During development, the app remains in "Testing" mode and requires adding authorized Test Users).
3. Provide App Information:
   - App Name: `Scratchly Mail`
   - User support email: `your-admin@example.com`
   - Developer contact email: `your-admin@example.com`
4. Add Test Users (Required in External Testing Mode):
   - Under **Test users**, click **+ ADD USERS**.
   - Enter your developer Gmail address (e.g., `arunbhadouriya06@gmail.com`).
   - *Note: Only accounts listed under Test users can authorize while the app is in testing mode.*

---

## 2. OAuth Scopes & Justification

Scratchly Mail adheres strictly to the principle of least privilege. We **never** request full mailbox access (`https://mail.google.com/`). The following minimum scopes are requested:

| Scope | Type | Purpose / Justification |
| :--- | :--- | :--- |
| `openid` | Non-sensitive | OpenID Connect token for user authentication |
| `https://www.googleapis.com/auth/userinfo.email` | Non-sensitive | Retrieves authenticated Google account email address |
| `https://www.googleapis.com/auth/userinfo.profile` | Non-sensitive | Retrieves authenticated user display name |
| `https://www.googleapis.com/auth/gmail.readonly` | **Restricted** | Required to list recent inbox messages, retrieve message details, and view threads inside Scratchly Mail |
| `https://www.googleapis.com/auth/gmail.compose` | **Sensitive** | Required to create draft messages in the user's Gmail mailbox without sending |
| `https://www.googleapis.com/auth/gmail.send` | **Restricted** | Required to send individual 1-to-1 emails and thread replies upon explicit user action |

> [!IMPORTANT]
> **Google Verification Considerations for Production**:
> The `gmail.readonly` and `gmail.send` scopes are classified as **Restricted Scopes** by Google. For public production launch (beyond 100 test users), Google requires:
> 1. A comprehensive Security Assessment (CASA Tier 2 evaluation).
> 2. A published Privacy Policy detailing that email data is not used for advertising or model training.
> 3. An in-depth video walkthrough of the user consent flow.
> 
> *During development and internal testing, Google verification is NOT required as long as the app is in "Testing" mode with test users explicitly registered.*

---

## 3. Generate OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials > OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Name: `Scratchly Mail Local Dev`.
5. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `http://localhost:5174`
6. Authorized redirect URIs:
   - `http://localhost:4000/api/integrations/gmail/callback`
   - `http://localhost:4000/api/auth/google/callback`
7. Copy the generated **Client ID** and **Client Secret** into your root `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-key
   GOOGLE_REDIRECT_URI=http://localhost:4000/api/integrations/gmail/callback
   GOOGLE_OAUTH_SCOPES="openid,email,profile,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.compose"
   ```

---

## 4. Security & Storage Architecture

1. **State CSRF Binding**:
   The `state` parameter is generated using HMAC-SHA256:
   `HMAC_SHA256({ tenantId, userId, nonce, timestamp }, JWT_SECRET)`
   This cryptographically binds the callback to the active user session and enforces a strict 15-minute expiration window to prevent account-linking CSRF attacks.

2. **Token Encryption at Rest**:
   Both `access_token` and `refresh_token` are encrypted at rest using **AES-256-GCM** with a unique 96-bit IV and 128-bit authentication tag before being stored in the `EmailConnection` table in PostgreSQL.

3. **Zero Token Leakage**:
   The frontend never receives access tokens, refresh tokens, client secrets, or encryption keys. All communication with Google APIs occurs strictly server-side through `GmailService`.

4. **Node 22+ Stream Incompatibility Fix**:
   In Node.js 22/24, Google APIs use native `fetch` rather than legacy `node-fetch` v2 to prevent `Premature close` socket decompression errors on gzip-encoded responses.

---

## 5. Amazon Web Services (Amazon SES Setup)

### Step 5.1: Verify Sending Identity
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/) and navigate to **Amazon Simple Email Service (SES)**.
2. Select your desired region (e.g. `ap-south-1` or `us-east-1`).
3. Under **Configuration > Identities**, click **Create identity**.
4. Choose **Email address** (e.g., `arunbhadouriya06@gmail.com`).
5. Open your inbox and click the verification link sent by Amazon.

### Step 5.2: Sandbox Mode Notice
- New AWS accounts start in SES Sandbox mode (maximum 200 emails/24h, 1 email/sec).
- In Sandbox mode, emails can **only** be sent to verified addresses (e.g. `24it10ar29@mitsgwl.ac.in` and `arunbhadouriya06@gmail.com`).
- To send campaigns to unverified recipients, request production access in **SES > Account dashboard > Request production access**.

---

## 6. Local Testing Procedure

### Testing Gmail OAuth & Mailbox:
1. Ensure the dev servers are running: `pnpm run dev`
2. Open [http://localhost:5173/?tab=connections](http://localhost:5173/?tab=connections)
3. Click **Connect Gmail Account**
4. Select your authorized Google account and grant permissions
5. Once redirected back, verify:
   - Green banner: "Gmail account authorized and connected successfully!"
   - Status shows **Connected** with your email address
   - Recent inbox messages load in the message list
   - Clicking a message opens the details modal with sanitized HTML
   - Senders are checked against your CRM Contact database
   - Try creating a draft or sending an individual email with review confirmation!

### Troubleshooting:
- **`GMAIL_NOT_CONFIGURED`**: Verify that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env` and do not contain placeholder values.
- **`invalid_grant` / `GMAIL_REAUTH_REQUIRED`**: Refresh token was revoked in Google Account settings. Click **Reconnect Gmail** to re-authorize.
- **`Premature close`**: Resolved by setting `fetchImplementation: fetch` in `GmailService.getOAuth2Client()`.
