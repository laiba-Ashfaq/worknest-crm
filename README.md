# WorkNest — Unified Business Management Platform

> **Hackathon Theme:** Unified Business Management Platform  
> **UI Design Template:** Whitepace — SaaS Landing Page & Dashboard  
> **Target Audience:** Service businesses (Solar installation companies, Real estate agencies, Healthcare clinics) with 5–30 employees.  
> **Core Business Promise:** *Every lead must have one accountable owner at a time, and ignored leads must automatically escalate until someone takes responsibility.*

---

## 1. System Architecture & Tech Stack

WorkNest is a full-stack, multi-tenant SaaS application built with end-to-end database persistence, real-time WebSocket state synchronization, and durable background job scheduling:

- **Frontend:**
  - React 18, TypeScript, Vite
  - Tailwind CSS styled with Whitepace Figma design tokens (`#043873` Navy, `#4F9CF9` Sky Blue, `#FFE492` Warm Yellow)
  - TanStack React Query for data synchronization
  - Recharts for live operational pipeline visualizations
  - Lucide React for consistent business iconography
  - Socket.IO Client for real-time lead escalation alerts without page reloads
- **Backend:**
  - Node.js (v24), Express, TypeScript
  - Prisma ORM with SQLite database persistence (guaranteed restart survivability)
  - Durable database-backed job scheduler (`DurableJob` engine with transactional locks)
  - Socket.IO Server with workspace-level authorization rooms
  - bcrypt password hashing & JWT session authentication
  - Rate limiting & input validation schemas
- **Integrations for Pakistan & Global:**
  - **Meta WhatsApp Cloud API:** Inbound lead capture webhooks, contact linking, two-way messaging, opt-out enforcement.
  - **Safepay Sandbox (Pakistan Gateway):** Hosted checkout session creation in PKR, HMAC SHA256 webhook signature verification, idempotent payment settlement, revenue separation.
  - **Google Calendar API:** OAuth 2.0 scheduling, representative busy periods, automatic conflict detection.
  - **SMTP Email Notifications:** Manager escalation alerts with deep links.
  - *(Strictly zero Stripe, Twilio, or Telegram used).*

---

## 2. Directory Structure

```
d:\CRM\
├── package.json                 # Root script runner
├── .env.example                 # Environment variables specification
├── .gitignore
├── server/                      # Express + Prisma Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma        # Normalized 27-model schema
│   ├── scripts/
│   │   └── seed.ts              # Demo seed data script
│   └── src/
│       ├── app.ts               # Express factory & middlewares
│       ├── index.ts             # Server entrypoint & WebSocket initialization
│       ├── config/              # Environment config loader
│       ├── middleware/          # Auth, workspace scoping, RBAC permissions
│       ├── services/
│       │   ├── assignment.service.ts   # Concurrency-safe round-robin & SLA engine
│       │   ├── escalation.worker.ts    # Durable background escalation scheduler
│       │   ├── audit.service.ts        # Append-only audit logger
│       │   ├── socket.service.ts       # Authenticated WebSocket broadcaster
│       │   └── integrations/           # Adapters: WhatsApp, Safepay, Google, SMTP
│       ├── routes/              # Modular REST controllers
│       └── test/
│           └── core.test.ts     # Automated test suite (Vitest)
└── client/                      # Vite + React + Tailwind Frontend
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js       # Whitepace color palette
    └── src/
        ├── App.tsx              # Router & Protected route barriers
        ├── context/             # AuthContext with live availability
        ├── components/          # AppLayout, MetricCard, Modals
        └── pages/               # Dashboard, Leads, Recovery, Pipelines, Contacts,
                                 # Conversations, Appointments, Payments, Team,
                                 # Integrations, Audit, PublicLeadForm, Landing
```

---

## 3. Quickstart & Local Setup

### Step 1: Install Dependencies & Setup Environment

```bash
# Server setup
cd server
npm install
npx prisma generate
npx prisma db push
npm run seed

# Client setup
cd ../client
npm install
```

### Step 2: Configure Environment Variables

Create `.env` in `server/.env` (pre-configured with working defaults):

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=worknest_dev_jwt_secret_key_super_secure_987654321_token
SESSION_EXPIRY=7d
DATABASE_URL="file:./dev.db"

# Demonstration Mode (Fast 30-second timers for live judge evaluation)
DEMO_MODE=true
DEFAULT_DEMO_TIMER_SECONDS=30

# Integrations (Left blank by default to demonstrate real "Not Connected" states)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=

SAFEPAY_API_KEY=
SAFEPAY_SECRET_KEY=
SAFEPAY_WEBHOOK_SECRET=
SAFEPAY_SANDBOX_URL=https://sandbox.api.getsafepay.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google-calendar/callback

SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
SMTP_FROM="WorkNest Alerts <alerts@worknest.app>"
```

### Step 3: Run the Application

```bash
# Terminal 1: Run Backend & Durable Worker (Port 5000)
cd server
npm run dev

# Terminal 2: Run Frontend (Port 5173)
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 4. Pre-Configured Demo Accounts (Password: `Password123!`)

| Role | Email | Capabilities & Scenarios |
|---|---|---|
| **Owner** | `owner@worknest.app` | Executive privileges, full workspace settings, immutable owner safeguard. |
| **Admin** | `admin@worknest.app` | Pipeline configurations, custom fields, member role management. |
| **Manager** | `manager@worknest.app` | Supervisor Recovery Queue triage, reassignments, performance insights. |
| **Sales Rep (Available)** | `hamza@worknest.app` | Available to receive leads; has 2 open deals and live countdown timers. |
| **Sales Rep (Busy)** | `zainab@worknest.app` | Marked BUSY (excluded from receiving new leads by capacity rules). |
| **Sales Rep (On Leave)** | `usman@worknest.app` | Marked ON LEAVE (leads automatically reassigned to available colleagues). |
| **Sales Rep (Offline)** | `ayesha@worknest.app` | Marked OFFLINE (excluded from new lead assignments). |

---

## 5. Step-by-Step Judge Demonstration Script

1. **View the Whitepace Landing Page & Log In:**
   - Navigate to `http://localhost:5173/`.
   - Click "Sign In", then click the **1-Click Demo Button for Owner (`owner@worknest.app`)**.
   - You enter the Operational Dashboard displaying 8 live metrics, pipeline stage charts, and the live team availability roster.

2. **Submit a Customer Inquiry via the Public Form:**
   - In a new tab or private window, open:  
     `http://localhost:5173/public/lead/apex-solar-pk`
   - Fill out an inquiry:
     - Name: `Tariq Aziz`
     - Phone: `03009988776`
     - Title: `Commercial 100kW Solar Rooftop Installation`
   - Click "Submit Inquiry".
   - Notice: Input phone is normalized to `+923009988776`.

3. **Observe Real-Time Assignment & SLA Countdown:**
   - Switch back to the dashboard tab.
   - The "New Leads Today" metric increments instantly via WebSocket!
   - Open **Leads & Accountability** (`/leads`).
   - The newly created lead appears at the top, assigned to `Hamza Ali` (the eligible Available rep).
   - A live countdown timer (`⏱ 30s left`) is actively ticking down!

4. **Demonstrate Automatic Escalation:**
   - Wait 30 seconds without acknowledging the lead.
   - When the countdown expires, the durable background escalation engine automatically:
     - Detects the SLA breach.
     - Advances the lead to Escalation Level 1.
     - Reassigns the lead to the next eligible colleague.
     - Broadcasts real-time escalation events and writes an append-only audit entry.

5. **Acknowledge a Lead via Qualifying Actions:**
   - Click "Acknowledge" or click "Note" and add a qualification note.
   - The countdown immediately stops, the status changes to `ACKNOWLEDGED`, and the **exact Time to First Response (in seconds)** is recorded and permanently locked.

6. **Demonstrate Absence Reassignment (On Leave / Offline):**
   - Click your availability badge in the top right navbar.
   - Change your status to **"On Leave"** or navigate to `/team` and switch `Hamza Ali` to "On Leave".
   - The absence engine immediately finds all unacknowledged leads and re-routes them to available teammates.

7. **Recovery Queue Triage:**
   - Open **Recovery Queue** (`/recovery`).
   - Observe leads that have reached maximum escalation tiers or were placed into fallback.
   - As a manager, click **"Recover & Assign"** to assign a new owner and resolve the bottleneck.

8. **Sales Pipeline & Stage Validation:**
   - Open **Sales Pipeline** (`/pipeline`).
   - Drag or select "Move Stage" to advance an opportunity to "Proposal Presented".
   - If required fields (e.g. Expected Value) are missing, a clear stage validation error is shown!

9. **Safepay Sandbox Payment Demonstration:**
   - Open **Payments** (`/payments`).
   - Observe the separation between **Collected Revenue** (PKR 450,000) and **Pending Projections** (PKR 185,000).
   - Click "Create Payment Request" to generate a hosted Safepay checkout link in PKR.
   - Click **"Simulate Webhook"** on a pending payment to simulate an authoritative provider webhook callback; watch the status instantly update to `PAID` in real time!

10. **Inspect Append-Only Audit Trail:**
    - Open **Audit Trail** (`/audit`).
    - Every event (registration, assignment, escalation, availability shift, payment webhook) is displayed with actor type, target record ID, and before/after states.

---

## 6. Automated Testing

Run the automated test suite verifying multi-tenancy isolation, round-robin availability, acknowledgement locking, absence reassignment, and webhook signature verification:

```bash
cd server
npm test
```

Expected output:
```
 ✓ src/test/core.test.ts (7 tests) 764ms
 Test Files  1 passed (1)
 Tests       7 passed (7)
```
