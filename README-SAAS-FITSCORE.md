# SaaS FitScore — AdsVise Growth Intelligence Platform

## Overview

**SaaS FitScore** is a production-ready, native growth intelligence scorecard built directly into the existing **AdsVise** (`adsvise.in`) website infrastructure. It enables B2B SaaS founders to evaluate their commercial engine across five connected dimensions:

1. **Positioning** (Ideal customer clarity, problem definition, outcome messaging, differentiation)
2. **Acquisition** (CTA hierarchy, proof architecture, signup friction, pricing visibility)
3. **Activation** (First product experience, time-to-value, milestone guidance)
4. **Monetisation** (Plan differentiation, free vs. paid boundaries, expansion catalysts)
5. **Retention** (Recurring utility, workflow integrations, customer education, ecosystem lock-in)

The product delivers a personalized, evidence-backed scorecard, identified growth constraints, and a prioritized 30-60-90 day improvement roadmap—naturally transitioning into the paid positioning advisory product: **"System to Make the Right Buyers Choose You"**.

---

## 1. Architecture & Website Integration

SaaS FitScore is **not** a detached microservice, standalone application, or separate theme. It is built as a native page inside AdsVise using the existing framework:

- **Server:** Node.js native `http` server in `server.js`, serving clean URLs without framework bloat.
- **Frontend:** Vanilla HTML5, modern CSS3, and ES6+ JavaScript.
- **Scoped Design Language:** All CSS is strictly scoped under `.saas-fitscore` and `#saas-fitscore-root` inside `saas-fitscore.css`, utilizing AdsVise brand tokens (`--bg-dark: #09090b`, `--bg-card: #18181b`, `--bg-cream: #FAF9F6`, `--lime-green: #a3e635`, `--brand-blue: #3b82f6`, `--radius: 20px`).
- **Typography:** AdsVise standard fonts: `Epilogue` (Headings) and `Inter` (Body).
- **Navigation & Brand:** Reuses the authentic AdsVise header, logo (`logo.png`), footer logo (`footerlogo.png`), custom cursor (`#cursor-dot`, `#cursor-ring`), and footer structure.

---

## 2. Directory Structure

```text
├── saas-fitscore.html          # Native landing page, 2-step questionnaire, and interactive scorecard
├── saas-fitscore.css           # Scoped design system and print stylesheet
├── saas-fitscore.js            # Client-side step validation, stage polling, and Razorpay modal
├── saas-fitscore-admin.html    # Protected admin dashboard for leads, diagnostics, and CSV export
├── lib/
│   └── saas-fitscore/
│       ├── ssrf-guard.js       # IP/DNS security validator blocking localhost, private & metadata IPs
│       ├── crawler.js          # Firecrawl API integration with resilient SSRF-safe HTTP fallback
│       ├── firestore.js        # Google Cloud Firestore v1 REST API layer with RS256 JWT auth
│       ├── scoring.js          # 100% deterministic 5-dimension scoring engine
│       ├── gemini.js           # Google Gemini (Flash model) positioning consultant engine
│       ├── mailer.js           # Hostinger SMTP transactional email delivery (nodemailer)
│       └── router.js           # Clean API route dispatcher integrated into server.js
├── test/
│   ├── test-stage3-4.js        # Unit test suite for SSRF guard, crawler, and Firestore
│   ├── test-pipeline.js        # Integration test suite for scoring, Gemini, and pipeline
│   └── test-server-endpoints.js# HTTP server route & API verification suite
├── server.js                   # Existing AdsVise server (+24 lines for modular route delegation)
└── README-SAAS-FITSCORE.md     # This comprehensive guide
```

---

## 3. Asynchronous Pipeline & Polling Workflow

To avoid request timeouts and handle crawling, scoring, and AI analysis efficiently:

```
[Founder Submits Form]
          │
          ▼
POST /api/saas-fitscore/submit
   ├── 1. Validates inputs & enforces 30-day rate limit per email
   ├── 2. Records Lead & Diagnostic in Firestore
   ├── 3. Returns { success: true, diagnosticId } immediately
   └── 4. Kicks off async pipeline in background:
          │
          ├── Stage 1: Crawl website (Firecrawl / safe fallback)
          ├── Stage 2: Calculate deterministic 5-dimension scores
          ├── Stage 3: Gemini consultative positioning analysis
          ├── Stage 4: Compile report & generate cryptographically secure token
          └── Stage 5: Dispatch email via Hostinger SMTP
```

The frontend polls `GET /api/saas-fitscore/status/:diagnosticId` every 2.5 seconds, dynamically updating the on-screen checklist until the completed scorecard renders seamlessly.

---

## 4. Environment Variables (`.env`)

Add the following environment variables to your `.env` file:

```env
# ─── Server & Routing ───
PORT=3000
BASE_URL=https://adsvise.in

# ─── Firebase Cloud Firestore ───
# Provide service account JSON as a string, path, or individual variables:
FIREBASE_PROJECT_ID=your-gcp-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----\n"
# OR set file path:
# FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-service-account.json

# ─── Google Gemini AI Developer API ───
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash

# ─── Website Crawling ───
FIRECRAWL_API_KEY=fc-your-key-here

# ─── Hostinger SMTP Email Delivery ───
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=sourav@adsvise.in
SMTP_PASS=your-hostinger-mailbox-password
SMTP_FROM_NAME="Sourav Sarkar | AdsVise"
EMAIL_TO=digitaladsexpresso@gmail.com

# ─── Razorpay Payments ───
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=your_razorpay_secret
PAID_PRODUCT_PRICE_PAISE=499900

# ─── Protected Admin Dashboard ───
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=your_secure_password
```

> **Note:** If `FIREBASE_PROJECT_ID` is omitted during local development, the system automatically uses local file persistence in `data/firestore-local.json` with identical operations, ensuring development is never blocked.

---

## 5. Security & SSRF Protection

- **SSRF Protection (`lib/saas-fitscore/ssrf-guard.js`):**
  - Protocol whitelist: Only `http:` and `https:` permitted.
  - DNS resolution check inspecting all resolved IP addresses.
  - Blocked ranges: `127.0.0.0/8` (Loopback), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918), `169.254.0.0/16` (Link-local & AWS/GCP/Azure metadata `169.254.169.254`), `::1`, and IPv4-mapped IPv6 ranges.
  - Max redirect limit: 3 hops, revalidating every redirect target.
  - Crawler domain lock: Crawling cannot wander onto unrelated external domains.
- **Database & Secrets:**
  - Zero Firestore administrative keys exposed to the browser.
  - All database writes happen exclusively through the backend.
  - Public report access uses unguessable 48-character hexadecimal tokens (`/saas-fitscore?token=...`).
- **Rate Limiting:**
  - Enforces one free assessment per work email per 30 days to prevent abuse.

---

## 6. Testing & Quality Verification

Three dedicated automated test suites are provided:

```bash
# 1. Run SSRF Guard & Firestore Tests
node test/test-stage3-4.js

# 2. Run Deterministic Scoring, Gemini, and Async Pipeline Tests
node test/test-pipeline.js

# 3. Run Server Endpoints & HTTP Route Tests
node test/test-server-endpoints.js
```

All 23 assertions pass with 100% success rate across all suites.

---

## 7. Protected Admin Dashboard

Navigate to:

```
http://localhost:3000/saas-fitscore/admin
```

- **Authentication:** Protected with standard base64 credentials against `DASHBOARD_USER` and `DASHBOARD_PASSWORD`.
- **Features:**
  - KPI counters: Total Leads, Total Diagnostics, Reports Generated, Paid Orders.
  - Live search by founder name, email, company, and domain.
  - Status filter: Completed, Crawling, Analyzing, Failed.
  - Direct 1-click links to view live scorecards.
  - Retry button for failed diagnostics.
  - **Export Leads to CSV:** Generates instant CSV downloads for CRM import.

---

## 8. Rollback Plan

If you ever need to revert:

1. The entire integration is committed on git branch `feature/saas-fitscore`.
2. To roll back to the clean state of `main`:
   ```bash
   git checkout main
   ```
3. Existing pages (`index.html`, `ad-audit.html`, `contact.html`, `privacy-policy.html`) remain 100% pristine and unmodified.
