# Bot Runtime (Draft)

This package hosts the WhatsApp session manager responsible for connecting phone numbers to the automation platform.

## Quick start

```bash
cd runtime
npm install
cp .env.example .env   # add Supabase + WhatsApp credentials
npm run dev
```

## Responsibilities

- Watch Supabase for numbers that need onboarding.
- Spin up `whatsapp-web.js` clients, emit QR codes, and persist session updates.
- Forward connection events back to Supabase tables (`numbers`, `number_sessions`, `number_connection_events`).
- Capture WhatsApp traffic, persist normalized copies into `conversations` + `messages`, and route events through a pluggable bot executor.
- Cache the active bot deployment per number so every conversation/message is tagged with the correct `bot_version_id`.
- Expose a lightweight HTTP API so the admin UI can request QR regeneration and session status.

## Current limitations

- Incoming messages are stored for observability, but there is no executor yet to run bot flows or reply automatically.
- Message payloads are persisted as-is (no media downloads/PII scrubbing).
- Bot assignments are cached with a short TTL; dynamic reassignments may take up to a minute to propagate.
- The bundled executor is an `EchoBotExecutor` placeholder—swap it for real logic before shipping.

> This is a scaffold only. Fill in the WhatsApp client handlers, bot executor, and security controls before deploying to production.
