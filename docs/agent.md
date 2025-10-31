# Project Agent Brief

Single-stop context for assistants working on the botautov0.1 project. Read this first; then dive into the linked docs for details.

---

## 1. Product Snapshot
- **Goal**: Provide configurable WhatsApp bots built atop `whatsapp-web.js`, with an admin experience for building flows, onboarding numbers, and inspecting conversations.
- **Core promise**: Non-technical operators assemble reusable action modules; the runtime hosts WhatsApp sessions, executes the flow engine, and persists structured data for exports and integrations.
- **Tech pillars**: Node.js runtime (Puppeteer + `whatsapp-web.js`), Supabase Postgres, Redis cache, React admin UI using shadcn components styled by the NeoSketch design system.

Reference: `docs/architecture.md:3`.

---

## 2. Current Code / Prototype
- `index.js` (not yet in repo, user-provided snippet) runs a single-number WhatsApp bot:
  - Auth via `LocalAuth`, QR onboarding, allowlist gating.
  - In-memory session steps over a static `FORM_FIELDS` array.
  - Validates Arabic text, supports Arabic numerals, and stores submissions to `submissions.json`.
- Known gaps vs target architecture:
  - No call to `saveSubmission` on completion (must be fixed when adapting snippet).
  - Hard-coded prompts and allowlist; should be externalized into database-driven configuration.
  - Helpers (`isArabicText`, `normalizeNumberLike`) partially duplicated.
- Roadmap: refactor into layered runtime with adapters → engine → module handlers (plugin/microkernel pattern).

---

## 3. Architecture Overview
Summarized from `docs/architecture.md`.

### 3.1 Runtime & Hosting
- Containerized Node.js runtime with headless Chromium dependencies managed by PM2.
- Recommended hosting: AWS ECS Fargate / DigitalOcean Apps; mount encrypted volumes for WhatsApp sessions.
- Reverse proxy (Traefik/Nginx) terminates TLS and serves admin UI/API.
- Health endpoints expose WhatsApp session status.

### 3.2 Services
- **WhatsApp Runtime Service**: loads bot configs, processes inbound messages, orchestrates action modules, persists data.
- **Admin API**: REST layer for authentication, bot CRUD, session lifecycle, analytics queries.
- **Admin Web UI**: React SPA using shadcn components + NeoSketch styling; supports flow builder, previews, and monitoring.
- **Storage**: Supabase Postgres (configurations, metadata, RBAC), Redis (active conversation state, rate limits), volume storage for WhatsApp session files, optional analytics lake (S3/warehouse).
- **Observability**: Centralized logging, metrics, alerts on session health, throughput, throttling.

### 3.3 Data Flow Highlights
1. Admin authenticates, registers number, scans QR, config saved to Postgres.
2. Runtime caches configs, handles messages via engine → modules, persists session state in Redis/Postgres.
3. Integrations/webhooks invoked as modules execute; events mirrored to analytics if enabled.
4. Admin UI queries transcripts/metrics via API (Postgres or analytics store).

---

## 4. Engine & Module Strategy
- Adopt a **plugin/microkernel** architecture.
- Flow configuration stored per bot version (`bot_versions.flow_definition`).
- Each step references a `module` key; modules implement a shared interface:
  - `validateConfig(config): ValidatedConfig`
  - `run(config, ctx, incomingMessage): ModuleResult`
- Context provides session identifiers, accumulated answers, utility adapters (`sendMessage`, database clients, logger).
- Module registry maps module names to handlers; both runtime and admin builder consult the same registry.
- Examples: `collect_text`, `collect_number`, `save_submission`, `webhook_call`, `crm_lookup`.

Implementation guidance example: see assistant response in this conversation (collect modules snippet).

---

## 5. Data Model Quick Reference
Source: `docs/data-model.md`.

- **Identity & Access**: `users`, `roles`, `user_roles`, `api_tokens`.
- **Bots**: `bots`, `bot_versions` (JSONB flow definitions, versioned), `number_bot_deployments`.
- **Action Templates**: `action_templates`, `action_template_versions` (input/output schema, UI schema).
- **Numbers & Sessions**: `numbers`, `number_sessions`, `number_connection_events`.
- **Conversations**: `conversations`, `messages` with JSONB payloads and delivery metadata.
- Conventions: UUID keys, timestamptz defaults, JSONB for flexible payloads, soft deletes via timestamp columns.

---

## 6. Admin API Surface
Reference: `docs/api.md`.

- Base path `/api/v1`, JWT auth, cursor pagination.
- Key groups:
  - `POST /auth/login`, `/refresh`, `/logout`.
  - User management (`GET/POST/PATCH /users`, reset password).
  - Numbers (`GET/POST /numbers`, QR retrieval, session restart, soft delete).
  - Bot configs (`GET/POST /bots`, version handling, publish flows).
- Each endpoint ties to the tables above; audit logging required for mutations.

---

## 7. NeoSketch Design System
Source: `docs/neo-sketch-design-system.md`.

- Palette: Paper `#FAF7F2`, Ink `#0A0D14`, Graph `#E6E1D9`, Primary Earth `#505F4E`, Accent Teal `#2CB1A1`, Metric Red `#D94841`, Marker Yellow `#FFE063`, status colors.
- Tokens defined as CSS variables (`:root`) covering colors, radii, spacing, shadows.
- Tailwind/shadcn integration instructions: map vars to Tailwind `extend`, use CVA variants to reference tokens.
- Components: button states, inputs, cards, tabs, alerts, chips; guidelines on focus rings, dashed borders, spacing.
- Motion & accessibility: 150–250ms transitions, cubic bezier ease, maintain WCAG AA contrast, ensure visible focus.
- Update procedure: edit doc → sync `globals.css` and `tailwind.config.js` → adjust components → communicate change.

---

## 8. Environments & Ops
- **Local**: Docker Compose stack (runtime, Postgres, Redis, admin UI); sandbox WhatsApp account for development.
- **Staging**: Single container, dedicated staging number, mirrors production schema, restricted access.
- **Production**: One runtime container per number (or sharded), independent Postgres schema, Redis namespace, regular session backups.
- Secrets via centralized manager (AWS Secrets Manager, Doppler). `.env.example` documents non-secret defaults.
- Security: RBAC enforcement, audit logs, TLS, encrypted storage, PII retention policies.
- Monitoring: Logging, metrics (throughput, latency, disconnects), scheduled synthetic conversations, automated backups.

---

## 9. Known Gaps / TODOs
- `admin-ui/` hosts the Next.js + shadcn NeoSketch admin UI scaffold:
  - Guided multi-step wizard for new bots lives at `/bots/new` (steps: details → triggers → flow → numbers → review).
  - NeoSketch tokens implemented in `src/app/globals.css`.
  - Navigation + placeholder pages for Dashboard, Bots, Numbers, Conversations, Settings.
  - `/bots/[botId]/builder` implements the bot-building journey (overview, triggers, flow steps, integrations, review) with sample data ready for wiring to real APIs.
  - Reusable shell component in `src/components/layout/app-shell.tsx`.
  - Local bot state (seed data + create flow) managed via `src/state/bots-context.tsx`; the “New bot” form writes to this store and routes to the builder.
  - Module definitions (config fields, defaults) live in `src/data/module-catalog.ts` and feed both the builder UI and bot state helpers.
  - Module configuration dialogs are rendered with shadcn `Dialog` + react-hook-form (`src/components/builder/module-config-dialog.tsx`), updating bot state via context helpers.
  - WhatsApp numbers are managed in `src/state/numbers-context.tsx`; the Numbers page uses `RegisterNumberDialog` to add numbers client-side until the backend exists.
  - Flow editor supports drag-and-drop ordering (`src/app/(app)/bots/[botId]/builder/page.tsx`) with context helpers (`src/state/bots-context.tsx`).
  - Numbers onboarding now surfaces mock QR details and assignment dialogs (`src/app/(app)/numbers/page.tsx`, `src/components/numbers/*`), syncing with bot assignments client-side.
- Module catalog for admin-configurable modules lives in `docs/module-catalog.md`; builder forms should reference those schemas.
- Persistence currently file-based in prototype; must integrate with Supabase/Redis infrastructure.
- Wizard currently keeps drafts in React state only; add autosave/resume (server persistence + local resume prompt) before production.
- Need structured logging across runtime and admin services to satisfy observability plan.
- Module registry implementation and admin UI integration remain to be built.
- Tailwind/shadcn configuration now references NeoSketch tokens; ensure new components continue to rely on those variables.

---

## 10. Working Agreements
- Treat docs under `docs/` as source of truth; update them before code changes that affect architecture, API, or UI guidelines.
- Use plugin/module architecture terminology consistently; avoid divergent jargon in code comments and docs.
- Before large refactors, add a note to this file summarizing scope so future assistants understand context.

> Editing this file: append new sections or bullets rather than rewriting existing history, unless the underlying decision changes. Always include references to supporting docs where applicable.
