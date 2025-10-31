# Operational Runbook (Draft)

Keep these steps lightweight so you can bootstrap local work quickly while the stack is still forming.

## 1. Local Development Setup
- Copy `.env.example` to `.env.local` and set:
  - `SUPABASE_URL=https://pnootqqmufcgyhpttqtq.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=<service-role key>` (store in secrets manager; never commit).
  - `NEXT_PUBLIC_SUPABASE_URL=https://pnootqqmufcgyhpttqtq.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBub290cXFtdWZjZ3locHR0cXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDg5MjAsImV4cCI6MjA3NTc4NDkyMH0.MkW2AeEbNvx47K1D7IRpCHpouK1IZaDv-EuACuymqvc` (safe for the browser bundle).
- Install dependencies (Node 18 LTS recommended) and run `npm install` once the project skeleton exists.
- Start Supabase CLI (optional) with `supabase link` if you want migrations from local scripts; otherwise connect directly via the hosted project.
- Front-end workspace:
  - `cd admin-ui && npm install` (first run only).
  - `npm run dev` to launch the NeoSketch admin UI at `http://localhost:3000`.
  - All theming comes from `src/app/globals.css` and `docs/neo-sketch-design-system.md`; update tokens there before tweaking components.

## 2. Deployment Checklist
- Confirm Supabase migrations are up to date: run `supabase db push` or apply SQL scripts via the dashboard.
- Verify environment secrets in hosting provider: Supabase keys, Redis URL, session storage path, third-party webhooks.
- Build and deploy the runtime/admin services (e.g., `docker compose build && docker compose push` or platform-specific pipelines).
- Smoke test:
  - `/status` responds with `200`.
  - WhatsApp number sessions show `connected` in Supabase.
  - Admin UI can fetch bot list without errors.

## 3. Backup & Restore
- Supabase: enable automated backups (project settings) and schedule weekly manual exports of critical tables (`bots`, `bot_versions`, `conversations`, `messages`).
- Store exported SQL/CSV snapshots in encrypted object storage.
- Restore drill (quarterly):
  - Create temporary database.
  - Apply latest schema migrations.
  - Import backup.
  - Run smoke tests against staging runtime.

## 4. Incident Response
- Detection triggers:
  - Runtime disconnect alert in `alerts` table.
  - Health monitor reports failed `/status`.
  - WhatsApp rate-limit errors in logs.
- First response:
  - Acknowledge alert in Supabase (`alerts.status = 'acknowledged'`).
  - Check `number_connection_events` for disconnect timestamps.
  - Restart affected sessions via `POST /numbers/{id}/session/restart`.
  - Escalate to vendor (if Meta issue) after 30 minutes unresolved.
- Post-incident:
  - Capture summary in `audit_log_entries`.
  - File ADR or update documentation if mitigation requires process change.

---

> Keep refining these steps as soon as the runtime code exists—note actual command names, add links to dashboards, and document the owners for each action.
