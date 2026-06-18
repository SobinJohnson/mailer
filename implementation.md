# KOLDPWR Outbound Mailing System — Implementation Plan

**Stack:** Next.js 14 (App Router) · Supabase (PostgreSQL + Storage + Auth) · Hostinger SMTP · Nodemailer · Stage 2: Claude (Anthropic SDK) + Gemini (Google AI SDK)
**Tooling:** Antigravity (Claude + Gemini integration layer) · TypeScript throughout
**Audience:** B2B outbound to Tier 2/3 electronics manufacturers, EMS units, PCB assemblers

---

## Project Overview

A three-stage outbound mailing platform built specifically for KOLDPWR's sales and BD workflow. Stage 1 is a fully functional, no-AI mailing system with company CRM, campaign management, templated emails, SMTP configuration, file attachments, and intelligent send-gap scheduling. Stage 2 layers in AI-assisted content writing via Claude and Gemini. Stage 3 (on hold) adds automated prospect discovery.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 14 App                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  /dashboard  │  │  /companies  │  │  /campaigns   │  │
│  │  /compose    │  │  /contacts   │  │  /analytics   │  │
│  │  /settings   │  │  /templates  │  │  /queue       │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│               Next.js API Routes (/api/*)                │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼────────────────┐
         │               │                │
   ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
   │  Supabase  │  │ Nodemailer │  │ Supabase   │
   │ PostgreSQL │  │ (Hostinger │  │  Storage   │
   │            │  │   SMTP)    │  │ (PDFs/Docs)│
   └────────────┘  └────────────┘  └────────────┘
```

---

## Stage 1 — Core Mailing System (No AI)

### Feature Set

- Company CRM (add, edit, tag, import CSV)
- Contact management per company (multiple contacts per company)
- Email template builder (rich text, variable substitution)
- Campaign management (group companies, assign template, schedule)
- SMTP configuration panel (Hostinger credentials stored securely)
- File attachment support (PDF, DOCX via Supabase Storage)
- Send queue with intelligent gap scheduling (auto-delay between sends)
- Delivery tracking (sent / failed / pending status)
- Dashboard with send stats and queue visibility

---

## Tech Stack & Tooling Decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | Full-stack, API routes, SSR, file-based routing |
| Database | Supabase PostgreSQL | Managed Postgres, auth, storage, real-time, free tier |
| File Storage | Supabase Storage | PDFs, DOCX, images — bucket per campaign |
| SMTP | Nodemailer + Hostinger | Battle-tested, Hostinger SMTP config straightforward |
| Auth | Supabase Auth | Built-in, row-level security |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI without custom CSS debt |
| AI (Stage 2) | Anthropic SDK (Claude) + Google AI SDK (Gemini) | Dual-model via Antigravity abstraction layer |
| Queue | Supabase DB + Next.js cron (Vercel cron or self-hosted) | Avoids separate Redis infra for Stage 1 |
| Validation | Zod | Schema validation on API routes |
| Email parsing | Nodemailer | HTML + plain text multipart |

---

## Database Schema (Supabase / PostgreSQL)

### Table: `companies`

```sql
CREATE TABLE companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  industry      TEXT,
  city          TEXT,
  state         TEXT,
  website       TEXT,
  linkedin_url  TEXT,
  notes         TEXT,
  tags          TEXT[],                       -- e.g. ['EMS', 'PCB', 'Tier2']
  status        TEXT DEFAULT 'active',        -- active | inactive | do_not_contact
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Table: `contacts`

```sql
CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT NOT NULL,
  designation   TEXT,                         -- e.g. "Purchase Manager", "Plant Head"
  phone         TEXT,
  is_primary    BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX ON contacts(email);
```

### Table: `email_templates`

```sql
CREATE TABLE email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,               -- supports {{first_name}}, {{company_name}} etc.
  body_text     TEXT,                        -- plain text fallback
  variables     JSONB DEFAULT '[]',          -- list of variable names used in template
  category      TEXT,                        -- intro | follow_up | product | event
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Table: `campaigns`

```sql
CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  template_id      UUID REFERENCES email_templates(id),
  from_name        TEXT NOT NULL,
  from_email       TEXT NOT NULL,
  reply_to         TEXT,
  status           TEXT DEFAULT 'draft',     -- draft | scheduled | running | paused | completed
  send_gap_minutes INTEGER DEFAULT 15,       -- gap between sends (default 15 min)
  gap_jitter_pct   INTEGER DEFAULT 20,       -- ±20% randomness on gap to avoid spam detection
  scheduled_at     TIMESTAMPTZ,              -- when to start the campaign
  attachments      JSONB DEFAULT '[]',       -- [{filename, storage_path, size}]
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

### Table: `campaign_recipients`

```sql
CREATE TABLE campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  company_id      UUID REFERENCES companies(id),
  status          TEXT DEFAULT 'pending',    -- pending | queued | sent | failed | skipped
  scheduled_send  TIMESTAMPTZ,              -- calculated send time (with gap applied)
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  email_snapshot  JSONB,                    -- final rendered subject + body at send time
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON campaign_recipients(campaign_id, status);
CREATE INDEX ON campaign_recipients(scheduled_send) WHERE status = 'queued';
```

### Table: `smtp_configs`

```sql
CREATE TABLE smtp_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL,               -- e.g. "Hostinger - info@koldpwr.com"
  host         TEXT NOT NULL,               -- smtp.hostinger.com
  port         INTEGER DEFAULT 465,
  secure       BOOLEAN DEFAULT true,        -- SSL
  username     TEXT NOT NULL,
  password     TEXT NOT NULL,               -- encrypted at rest via Supabase vault / env
  from_email   TEXT NOT NULL,
  from_name    TEXT,
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Table: `send_log`

```sql
CREATE TABLE send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID REFERENCES campaign_recipients(id),
  campaign_id     UUID REFERENCES campaigns(id),
  contact_email   TEXT,
  status          TEXT,                      -- sent | failed | bounced
  smtp_response   TEXT,
  sent_at         TIMESTAMPTZ DEFAULT now()
);
```

### Table: `attachments`

```sql
CREATE TABLE attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,             -- Supabase Storage path
  mime_type      TEXT,
  size_bytes     INTEGER,
  uploaded_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## Project Structure

```
koldpwr-mailer/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar + nav shell
│   │   ├── page.tsx                      # Dashboard home
│   │   ├── companies/
│   │   │   ├── page.tsx                  # Company list, search, filter
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx              # Company detail + contacts + history
│   │   │   └── import/
│   │   │       └── page.tsx              # CSV import
│   │   ├── contacts/
│   │   │   └── page.tsx                  # All contacts, cross-company
│   │   ├── templates/
│   │   │   ├── page.tsx                  # Template list
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Template editor
│   │   ├── campaigns/
│   │   │   ├── page.tsx                  # Campaign list
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Campaign detail
│   │   │       ├── recipients/
│   │   │       │   └── page.tsx          # Recipient list + status
│   │   │       └── analytics/
│   │   │           └── page.tsx          # Send stats
│   │   ├── queue/
│   │   │   └── page.tsx                  # Live send queue viewer
│   │   └── settings/
│   │       └── page.tsx                  # SMTP config, account settings
│   └── api/
│       ├── companies/
│       │   ├── route.ts                  # GET list, POST create
│       │   ├── [id]/route.ts             # GET, PUT, DELETE
│       │   └── import/route.ts           # CSV import handler
│       ├── contacts/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── templates/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── campaigns/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   ├── [id]/recipients/route.ts
│       │   ├── [id]/launch/route.ts      # Trigger campaign, schedule queue
│       │   └── [id]/pause/route.ts
│       ├── send/
│       │   └── process/route.ts          # Called by cron, processes pending queue
│       ├── attachments/
│       │   └── route.ts                  # Upload to Supabase Storage
│       └── smtp/
│           ├── route.ts
│           └── test/route.ts             # Test SMTP connection
├── components/
│   ├── ui/                               # shadcn/ui base components
│   ├── companies/
│   │   ├── CompanyTable.tsx
│   │   ├── CompanyForm.tsx
│   │   └── CompanyImport.tsx
│   ├── contacts/
│   │   └── ContactForm.tsx
│   ├── templates/
│   │   ├── TemplateEditor.tsx            # Rich text editor (Tiptap)
│   │   └── TemplatePreview.tsx
│   ├── campaigns/
│   │   ├── CampaignWizard.tsx            # Step-by-step campaign builder
│   │   ├── RecipientSelector.tsx         # Pick companies/contacts
│   │   ├── GapScheduler.tsx              # Configure send gap UI
│   │   └── QueueTimeline.tsx             # Visual timeline of scheduled sends
│   ├── dashboard/
│   │   ├── StatCards.tsx
│   │   └── RecentActivity.tsx
│   └── shared/
│       ├── AttachmentUploader.tsx
│       └── SmtpConfigForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser client
│   │   └── server.ts                     # Server client (API routes)
│   ├── mailer/
│   │   ├── nodemailer.ts                 # Transporter factory
│   │   ├── renderer.ts                   # Template variable substitution
│   │   ├── scheduler.ts                  # Gap + jitter calculation
│   │   └── sender.ts                     # Core send function
│   ├── queue/
│   │   └── processor.ts                  # Queue tick logic
│   └── validators/
│       ├── company.ts
│       ├── campaign.ts
│       └── smtp.ts
├── types/
│   └── index.ts                          # All TypeScript interfaces
├── middleware.ts                          # Auth guard
└── .env.local
```

---

## Core Logic Deep Dives

### 1. Send Gap + Jitter Scheduler

When a campaign is launched, the system pre-calculates `scheduled_send` for every recipient. This keeps sends spread out naturally and avoids spam triggers.

```typescript
// lib/mailer/scheduler.ts

export function calculateSendTimes(
  recipientCount: number,
  startAt: Date,
  gapMinutes: number,
  jitterPct: number     // 0–100, applied as ±jitterPct% of gapMinutes
): Date[] {
  const times: Date[] = [];
  let cursor = new Date(startAt);

  for (let i = 0; i < recipientCount; i++) {
    times.push(new Date(cursor));

    const jitterFraction = (Math.random() * 2 - 1) * (jitterPct / 100);
    const jitteredGapMs = gapMinutes * 60 * 1000 * (1 + jitterFraction);
    cursor = new Date(cursor.getTime() + jitteredGapMs);
  }

  return times;
}

// Example: 50 recipients, 15 min gap, ±20% jitter
// → gaps between 12–18 minutes, total spread: ~11 hours
```

The scheduler also respects business hours (9 AM – 7 PM IST). Sends scheduled outside that window automatically push to the next valid slot.

```typescript
function nextBusinessSlot(dt: Date): Date {
  const IST_OFFSET = 5.5 * 60; // minutes
  const local = new Date(dt.getTime() + IST_OFFSET * 60000);
  const hour = local.getUTCHours();
  const day = local.getUTCDay(); // 0=Sun, 6=Sat

  if (day === 0) local.setUTCDate(local.getUTCDate() + 1);
  if (day === 6) local.setUTCDate(local.getUTCDate() + 2);
  if (hour < 9) local.setUTCHours(9, 0, 0, 0);
  if (hour >= 19) {
    local.setUTCDate(local.getUTCDate() + 1);
    local.setUTCHours(9, 0, 0, 0);
  }

  return new Date(local.getTime() - IST_OFFSET * 60000);
}
```

---

### 2. Template Variable Renderer

Templates support `{{variable}}` syntax. At send time, variables are resolved per contact/company.

```typescript
// lib/mailer/renderer.ts

interface RenderContext {
  first_name: string;
  last_name?: string;
  company_name: string;
  designation?: string;
  city?: string;
  sender_name: string;
  sender_email: string;
}

export function renderTemplate(
  template: string,
  context: RenderContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (context as Record<string, string>)[key] ?? `{{${key}}}`;
  });
}

// Snapshot rendered email at time of queueing and store in campaign_recipients.email_snapshot
// This means edits to template after launch don't affect in-flight sends
```

---

### 3. Nodemailer Transporter with Attachment Support

```typescript
// lib/mailer/sender.ts

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function sendMail({
  smtpConfig,
  to,
  subject,
  html,
  text,
  attachments,   // [{filename, storage_path}]
}: SendMailOptions) {

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
  });

  // Fetch attachment buffers from Supabase Storage
  const resolvedAttachments = await Promise.all(
    attachments.map(async (att) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      const { data } = await supabase.storage
        .from('campaign-attachments')
        .download(att.storage_path);

      const buffer = Buffer.from(await data!.arrayBuffer());
      return { filename: att.filename, content: buffer };
    })
  );

  const result = await transporter.sendMail({
    from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
    to,
    subject,
    html,
    text,
    attachments: resolvedAttachments,
  });

  return result;
}
```

---

### 4. Queue Processor (Cron-driven)

A cron endpoint runs every 5 minutes and processes pending recipients whose `scheduled_send` has passed.

```typescript
// app/api/send/process/route.ts

export async function POST(req: Request) {
  // Validate cron secret header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  // Fetch due recipients
  const { data: due } = await supabase
    .from('campaign_recipients')
    .select(`
      *,
      contacts(*),
      companies(*),
      campaigns(
        *,
        email_templates(*),
        smtp_configs(*)
      )
    `)
    .eq('status', 'queued')
    .lte('scheduled_send', now)
    .limit(10);  // process 10 per tick to avoid timeouts

  if (!due?.length) return Response.json({ processed: 0 });

  let sent = 0, failed = 0;

  for (const recipient of due) {
    try {
      const context = buildRenderContext(recipient);
      const subject = renderTemplate(recipient.campaigns.email_templates.subject, context);
      const html = renderTemplate(recipient.campaigns.email_templates.body_html, context);
      const text = renderTemplate(recipient.campaigns.email_templates.body_text ?? '', context);

      await sendMail({
        smtpConfig: recipient.campaigns.smtp_configs,
        to: recipient.contacts.email,
        subject,
        html,
        text,
        attachments: recipient.campaigns.attachments ?? [],
      });

      await supabase
        .from('campaign_recipients')
        .update({ status: 'sent', sent_at: now })
        .eq('id', recipient.id);

      await supabase.from('send_log').insert({
        recipient_id: recipient.id,
        campaign_id: recipient.campaign_id,
        contact_email: recipient.contacts.email,
        status: 'sent',
      });

      sent++;
    } catch (err: any) {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', recipient.id);

      failed++;
    }
  }

  return Response.json({ processed: due.length, sent, failed });
}
```

**Cron configuration (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/send/process",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

For self-hosted / non-Vercel, use a `node-cron` script or systemd timer to hit the endpoint.

---

### 5. Hostinger SMTP Configuration

Hostinger's standard SMTP settings to pre-populate in the config panel:

```
Host:     smtp.hostinger.com
Port:     465 (SSL) or 587 (TLS/STARTTLS)
Secure:   true (port 465) / false with STARTTLS (port 587)
Username: your-full-email@yourdomain.com
Password: your-email-account-password
```

The settings panel tests the connection before saving, using nodemailer's `verify()`:

```typescript
// app/api/smtp/test/route.ts
const transporter = nodemailer.createTransport({ ...config });
await transporter.verify(); // throws on failure
```

Passwords are never returned to the frontend after initial save — only masked labels are shown.

---

### 6. File Attachment System

**Upload flow:**

1. User uploads PDF/DOCX via `AttachmentUploader` component
2. `POST /api/attachments` receives multipart form data
3. File is streamed directly to Supabase Storage bucket `campaign-attachments`
4. DB row inserted into `attachments` table with `storage_path`
5. Attachment ID is stored in `campaigns.attachments` JSONB array

**Storage bucket policy:**
- Private bucket (no public access)
- Only server-side service key can read/write
- Files fetched at send time and streamed as buffer to Nodemailer

**Recommended attachment handling:**
- Max file size: 5MB per file (Hostinger SMTP limit is usually 25MB total)
- Supported types: PDF, DOCX, PNG, JPG
- Files are shared across campaigns — same brochure can be reused

---

## API Route Reference

| Method | Route | Description |
|---|---|---|
| GET | `/api/companies` | List companies (search, filter, pagination) |
| POST | `/api/companies` | Create company |
| GET | `/api/companies/[id]` | Company detail |
| PUT | `/api/companies/[id]` | Update company |
| DELETE | `/api/companies/[id]` | Delete (soft) |
| POST | `/api/companies/import` | CSV bulk import |
| GET | `/api/contacts` | All contacts |
| POST | `/api/contacts` | Add contact |
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/[id]` | Update template |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| PUT | `/api/campaigns/[id]` | Update campaign |
| POST | `/api/campaigns/[id]/launch` | Launch campaign, schedule queue |
| POST | `/api/campaigns/[id]/pause` | Pause running campaign |
| GET | `/api/campaigns/[id]/recipients` | List recipients + status |
| POST | `/api/attachments` | Upload file to Storage |
| GET | `/api/smtp` | List SMTP configs |
| POST | `/api/smtp` | Add SMTP config |
| POST | `/api/smtp/test` | Test SMTP connection |
| POST | `/api/send/process` | Cron: process send queue |

---

## UI Pages — Stage 1

### Dashboard `/`

- Total companies, contacts, active campaigns
- Today's sends (scheduled vs sent vs failed)
- Queue status card (next send in X minutes)
- Recent campaign activity feed

### Companies `/companies`

- Table: name, industry, city, tags, # contacts, status, actions
- Search by name / city / tag
- Filter: status, tags, industry
- Add company (modal or slide-over)
- Bulk CSV import (with column mapping UI)
- Click through to company detail

### Company Detail `/companies/[id]`

- Company info (editable inline)
- Contacts tab: list of contacts, add/edit contact
- Campaign history tab: which campaigns sent to this company
- Notes / tags editor

### Contacts `/contacts`

- Global contact list across all companies
- Useful for one-off sends or finding duplicates

### Templates `/templates`

- Template cards with name, category, last edited
- Click to open Template Editor

### Template Editor `/templates/[id]`

- Tiptap rich text editor for `body_html`
- Plain text tab for `body_text` fallback
- Subject line field
- Variable chip inserter: click `{{first_name}}` to insert at cursor
- Live preview panel with sample data substitution

### Campaign Builder `/campaigns/new`

Step 1: **Basics** — name, description, from name/email, reply-to
Step 2: **Template** — pick template, preview with real data
Step 3: **Recipients** — pick companies + contacts (filter by tag/industry)
Step 4: **Attachments** — drag-drop files, browse saved attachments
Step 5: **Scheduling** — start time, gap (minutes), jitter %, business-hours-only toggle
Step 6: **Review** — full summary, estimated completion time, launch or save draft

### Campaign Detail `/campaigns/[id]`

- Status badge, progress bar (sent / total)
- Pause / Resume button
- Send timeline visualization (scheduled times plotted)
- Recipients table (filter by status: pending / sent / failed)
- Retry failed button (re-queues failed recipients)

### Queue Viewer `/queue`

- Live list of all queued sends across campaigns
- Columns: scheduled_send time, contact name, company, campaign, status
- Auto-refreshes every 30 seconds

### Settings `/settings`

- SMTP configurations (add, test, set default)
- Account info
- Notification preferences (email on campaign complete / on failure)

---

## Stage 1 — Build Phases

### Phase 1: Foundation (Week 1)

- [ ] Initialize Next.js 14 project with TypeScript, Tailwind, shadcn/ui
- [ ] Set up Supabase project, run all migrations
- [ ] Supabase Auth — login page, middleware auth guard
- [ ] Dashboard shell layout (sidebar, nav, responsive)
- [ ] Environment variables: Supabase URL/keys, SMTP, cron secret

### Phase 2: CRM (Week 1–2)

- [ ] Companies API routes (CRUD)
- [ ] Companies list page with search + filter
- [ ] Company detail page
- [ ] Contacts API routes (CRUD)
- [ ] Contact form (linked to company)
- [ ] CSV import handler with column mapping

### Phase 3: Templates (Week 2)

- [ ] Templates API routes
- [ ] Tiptap editor integration
- [ ] Variable substitution system
- [ ] Template preview with mock data
- [ ] Plain text fallback editor

### Phase 4: SMTP + Attachments (Week 2–3)

- [ ] SMTP config API + settings UI
- [ ] Hostinger SMTP connection test
- [ ] Supabase Storage bucket setup
- [ ] Attachment upload API
- [ ] Attachment uploader component
- [ ] Nodemailer sender with attachment resolution

### Phase 5: Campaign Engine (Week 3)

- [ ] Campaign CRUD API routes
- [ ] Campaign wizard UI (6 steps)
- [ ] Recipient selector with filtering
- [ ] Gap scheduler logic
- [ ] Campaign launch API (schedule all recipients)
- [ ] Queue processor cron endpoint
- [ ] Pause / resume logic

### Phase 6: Tracking + Queue UI (Week 3–4)

- [ ] Send log writes
- [ ] Campaign detail analytics
- [ ] Queue viewer page
- [ ] Retry failed sends
- [ ] Dashboard stats

### Phase 7: Polish + Testing (Week 4)

- [ ] End-to-end test: company → template → campaign → send
- [ ] Error handling on all API routes (Zod validation responses)
- [ ] Loading states, empty states, error toasts
- [ ] SMTP edge cases (bounces, connection timeout)
- [ ] Mobile responsiveness check
- [ ] Deploy to Vercel, configure cron

---

## Stage 2 — AI-Assisted Content (Antigravity + Claude + Gemini)

### What gets AI-assisted

1. **Email copy generation** — from a brief, generate a full outbound email
2. **Subject line variants** — generate 5 subject line options for A/B thinking
3. **Template rewriter** — paste existing copy, get a tightened/improved version
4. **Tone adjuster** — shift copy between formal / warm / direct
5. **Personalization suggestions** — highlight which parts of the email to vary per recipient
6. **Follow-up drafts** — generate follow-up 2 and 3 given the context of the original

### Antigravity Integration Layer

Antigravity acts as the routing and orchestration layer between Claude and Gemini. The model selection strategy:

| Task | Primary Model | Fallback |
|---|---|---|
| Long-form email drafting | Claude (claude-sonnet) | Gemini Pro |
| Subject line generation (bulk) | Gemini Flash | Claude Haiku |
| Tone rewriting | Claude | — |
| Template analysis | Claude | — |
| Cost-sensitive batch tasks | Gemini Flash | — |

```typescript
// lib/ai/antigravity.ts

type AITask =
  | 'draft_email'
  | 'subject_lines'
  | 'rewrite_tone'
  | 'followup_draft';

const MODEL_ROUTING: Record<AITask, 'claude' | 'gemini'> = {
  draft_email:    'claude',
  subject_lines:  'gemini',
  rewrite_tone:   'claude',
  followup_draft: 'claude',
};

export async function runAITask(
  task: AITask,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const model = MODEL_ROUTING[task];

  if (model === 'claude') {
    return runClaude(prompt, systemPrompt);
  } else {
    return runGemini(prompt, systemPrompt);
  }
}
```

```typescript
// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runClaude(userPrompt: string, systemPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return (message.content[0] as { text: string }).text;
}
```

```typescript
// lib/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runGemini(userPrompt: string, systemPrompt: string): Promise<string> {
  const model = genai.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}
```

### System Prompts for KOLDPWR Context

```typescript
// lib/ai/prompts.ts

export const KOLDPWR_BASE_CONTEXT = `
You are an expert B2B sales copywriter working for KOLDPWR, an ESD (electrostatic discharge) 
consumables and electronics handling solutions company based in Nagpur and Pune, India.

KOLDPWR sells to Tier 2/3 electronics manufacturers, EMS units, and PCB assembly plants across India.

Products include: ESD consumables, anti-static packaging, wrist straps, mats, ionizers, 
shelving, and related electronics handling solutions.

Brand voice: Technical authority without being preachy. Practical. Direct. 
The vendor you remember when things go wrong. Not salesy. Not fluffy.

When writing emails:
- Keep it concise (under 200 words body)  
- Acknowledge the prospect's likely pain point before pitching
- Use industry-specific language (PCB, SMT, ESD compliance, IPC standards)
- Avoid generic phrases like "I hope this email finds you well"
- Always end with a low-friction CTA (reply, quick call, catalogue link)
`;

export const SYSTEM_PROMPTS: Record<string, string> = {
  draft_email:    KOLDPWR_BASE_CONTEXT + '\nDraft a cold outbound email based on the brief provided.',
  subject_lines:  KOLDPWR_BASE_CONTEXT + '\nGenerate exactly 5 subject line options. Return as a JSON array of strings only.',
  rewrite_tone:   KOLDPWR_BASE_CONTEXT + '\nRewrite the provided email copy in the specified tone.',
  followup_draft: KOLDPWR_BASE_CONTEXT + '\nWrite a follow-up email referencing the original send context.',
};
```

### Stage 2 New UI Components

**AI Compose Panel** (inside Template Editor or Campaign Wizard)

- Brief input: "What's the goal? Who's the recipient type? Any specific angle?"
- Model selector: Claude / Gemini / Auto (Antigravity routing)
- Generate button → streaming response displayed in editor
- Accept / Regenerate / Edit before accepting
- Subject line generator: generates 5 options, click to apply

**Rewrite Tools Toolbar** (inside Template Editor)

- Buttons: Shorten · Formalize · Make warmer · Improve CTA · Generate follow-up
- Selected text is sent to AI; response replaces or appears alongside for comparison

### Stage 2 API Routes

```
POST /api/ai/draft          — generate email from brief
POST /api/ai/subjects       — generate subject line variants
POST /api/ai/rewrite        — rewrite selected text with tone
POST /api/ai/followup       — generate follow-up from original template context
```

### Stage 2 Build Phases

- [ ] Install `@anthropic-ai/sdk`, `@google/generative-ai`
- [ ] Antigravity routing layer (`lib/ai/antigravity.ts`)
- [ ] Claude and Gemini wrapper functions
- [ ] System prompts with KOLDPWR context
- [ ] AI Compose Panel component
- [ ] Subject line generator
- [ ] Rewrite toolbar in template editor
- [ ] Streaming responses (using Vercel AI SDK or custom SSE)
- [ ] Rate limiting on AI routes (to control API spend)
- [ ] Usage tracking (optional: log AI generations to `ai_usage` table)

---

## Stage 3 — Prospect Discovery (On Hold)

Scope marker only — no implementation yet.

**Planned capabilities:**
- Search for companies by industry / city / size criteria
- Pull company data from public directories, LinkedIn, GST registry
- Auto-enrich existing companies (website, LinkedIn, contact discovery)
- Scoring model: rank prospects by fit for KOLDPWR products
- One-click: add discovered companies to CRM and start campaign

**Likely stack:**
- Gemini for web data extraction and summarization
- Apollo.io / Hunter.io / Clay APIs for contact enrichment
- Custom scraping pipeline if needed
- Supabase pgvector for semantic search on company profiles

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...           # Server-only, never exposed to client

# SMTP (optional seed — most configs stored in DB)
DEFAULT_SMTP_HOST=smtp.hostinger.com
DEFAULT_SMTP_PORT=465

# AI (Stage 2)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Queue
CRON_SECRET=your-long-random-secret   # Validates cron endpoint calls

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Security Considerations

| Risk | Mitigation |
|---|---|
| SMTP credentials exposed | Stored in DB, never returned to client after save, masked in UI |
| Cron endpoint abuse | `CRON_SECRET` header validation |
| Unauthorized access to data | Supabase Auth + Row Level Security on all tables |
| Mass send abuse | Campaign launch requires explicit confirmation, rate limits on processor |
| AI API cost overrun | Per-request rate limiting, optional spend cap alerting |
| Attachment access | Private Supabase Storage bucket, server-side only access |
| Email spoofing | SPF/DKIM configured on Hostinger domain DNS |

### Supabase RLS Policy (example)

```sql
-- Users can only see their own company's data
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users only"
ON companies
FOR ALL
USING (auth.role() = 'authenticated');
```

For a single-user or small-team setup, this keeps all data behind the authenticated session.

---

## DNS / Deliverability Setup (Hostinger)

Before sending any campaign, configure these in Hostinger DNS panel:

1. **SPF record** (TXT on root domain):
   ```
   v=spf1 include:_spf.hostinger.com ~all
   ```

2. **DKIM** — Enable in Hostinger Email panel → "DKIM Signing". Copy the TXT record provided.

3. **DMARC** (TXT `_dmarc.yourdomain.com`):
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
   ```
   Start with `p=none` (monitor mode), move to `p=quarantine` after validating.

4. **Warmup plan for new domain:**
   - Week 1: max 20 emails/day
   - Week 2: max 50/day
   - Week 3: max 100/day
   - Week 4+: scale to 200–300/day
   - The gap scheduler naturally enforces this — configure gap accordingly

---

## Deployment

### Vercel (Recommended for Stage 1)

```bash
vercel --prod
```

- Set all environment variables in Vercel dashboard
- Enable Vercel Cron Jobs (free tier: 2 crons)
- Supabase connection: use connection pooling URL for serverless

### Self-Hosted Alternative

- Docker container on VPS (DigitalOcean / Hetzner)
- Nginx reverse proxy
- PM2 for process management
- `node-cron` inside Next.js server for queue processing

---

## Dependencies (package.json additions)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.4.0",
    "nodemailer": "^6.9.13",
    "@tiptap/react": "^2.4.0",
    "@tiptap/starter-kit": "^2.4.0",
    "@tiptap/extension-link": "^2.4.0",
    "zod": "^3.23.0",
    "papaparse": "^5.4.1",
    "date-fns": "^3.6.0",
    "tailwindcss": "^3.4.0",
    "@shadcn/ui": "latest"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.14",
    "@types/papaparse": "^5.3.14",
    "typescript": "^5.4.0"
  }
}
```

**Stage 2 additions:**
```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "@google/generative-ai": "^0.14.0",
  "ai": "^3.2.0"
}
```

---

## Milestone Summary

| Milestone | Deliverable | ETA |
|---|---|---|
| M1 | Project setup, DB schema, auth | End of Week 1 |
| M2 | CRM live (companies + contacts) | End of Week 2 |
| M3 | Templates + SMTP + attachments | Mid Week 3 |
| M4 | Campaign engine + queue processor | End of Week 3 |
| M5 | Full Stage 1 working end-to-end | End of Week 4 |
| M6 | AI compose panel (Stage 2) | End of Week 6 |
| M7 | Full AI writing suite (Stage 2) | End of Week 7 |
| M8 | Stage 3 scoping (prospect discovery) | TBD |

---

*Document version: 1.0 — Stage 1 + 2 detailed, Stage 3 on hold.*
*Stack: Next.js 14 · Supabase · Nodemailer · Hostinger SMTP · Claude · Gemini · Antigravity*
