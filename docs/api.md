# Admin API Specification (Skeleton)

This document captures the planned surface area for the Admin REST API backing the configuration web UI. Schema details and example payloads will be elaborated as implementation progresses.

## 1. Conventions
- Base URL: `/api/v1`
- Authentication: Bearer JWT issued via `POST /auth/login`
- Content type: `application/json` unless noted
- Pagination: cursor-based via `?cursor=` and `?limit=`
- Error format: standardized envelope `{ "error": { "code": "...", "message": "...", "details": {...} } }`

## 2. Authentication & Authorization
**Data model alignment:** Backed by `users`, `user_roles`, and `api_tokens`. Login/refresh flows read/write `users.status`, `users.last_login_at`, and persist refresh/API tokens to `api_tokens`. All credential mutations should emit `audit_log_entries`.
### POST `/auth/login`
- Purpose: exchange credentials (password or SSO token) for JWT + refresh token.
- Request body: `{ "email": "...", "password": "...", "mfa_code": "..."? }`
- Responses:
  - `200`: `{ "access_token": "...", "refresh_token": "...", "expires_in": 3600, "roles": ["admin"] }`
  - `401`: invalid credentials

### POST `/auth/refresh`
- Purpose: rotate access token using refresh token.
- Request body: `{ "refresh_token": "..." }`
- Response: `200` with new access token payload.

### POST `/auth/logout`
- Purpose: revoke refresh token (server-side blacklist).
- Request body: `{ "refresh_token": "..." }`
- Response: `204`

## 3. User & Role Management
**Data model alignment:** Operates on `users`, `roles`, and `user_roles`. Invitations and suspensions add rows or update `users.status`, while assignments manage the join table. Each change should log to `audit_log_entries`.
### GET `/users`
- List users with roles and status. Admin-only.

### POST `/users`
- Create user invitation; payload includes email, role, optional display name.

### PATCH `/users/{userId}`
- Update role, status (active/suspended).

### POST `/users/{userId}/reset-password`
- Trigger password reset workflow.

## 4. WhatsApp Numbers & Sessions
**Data model alignment:** Uses `numbers` (core metadata), `number_sessions` (runtime state + QR tokens), `bot_number_deployments` (assignment history), and `number_connection_events` (append-only status log). Deleting numbers sets archival timestamps rather than hard-deleting rows.
**Entity: Number**
- `id` (UUID) — unique identifier.
- `phone_number` (E.164 string) — e.g., `+14155552671`.
- `display_name` (string, 2-64 chars).
- `region` (ISO 3166-1 alpha-2).
- `owner_id` (UUID referencing users table).
- `status` (enum: `pending_qr`, `connected`, `disconnected`, `suspended`).
- `assigned_bot_id` (UUID | null).
- `last_connected_at` (ISO 8601 timestamp | null).
- `created_at` / `updated_at` (ISO 8601).

### GET `/numbers`
- Fetch registered numbers, status, assigned bot version, last seen timestamps.
- Query params:
  - `status` (optional enum).
  - `ownerId` (optional UUID).
  - `botId` (optional UUID).
- Response `200` body:
```json
{
  "data": [
    {
      "id": "9c6f5a54-92cd-4e3c-8bd2-5fda5c1b5c61",
      "phone_number": "+14155552671",
      "display_name": "Support Line",
      "region": "US",
      "status": "connected",
      "assigned_bot_id": "703b03e4-004d-4b16-8a78-3ae918649161",
      "last_connected_at": "2024-05-17T21:15:27Z"
    }
  ],
  "cursor": "eyJwYWdlIjoyfQ=="
}
```

### POST `/numbers`
- Register a new WhatsApp number; payload includes display name, region, owner.
- Response includes session onboarding status and QR code retrieval URL.
- Request body:
```json
{
  "phone_number": "+971501234567",
  "display_name": "UAE Sales",
  "region": "AE",
  "owner_id": "128a3c0f-2c01-4e9b-8739-3080cc1a9c6d",
  "notes": "Use for inbound leads"
}
```
- Validation:
  - `phone_number`: required, unique, E.164, max 20 chars.
  - `display_name`: required, 2-64 chars.
  - `region`: optional, must match ISO 3166-1 alpha-2.
  - `owner_id`: optional, must reference active user.
- Response `201` body:
```json
{
  "id": "37c8bfb7-3155-4ff3-9aef-d61a77b5c9af",
  "status": "pending_qr",
  "qr_code_url": "https://api.example.com/api/v1/numbers/37c8bfb7-3155-4ff3-9aef-d61a77b5c9af/qr",
  "expires_at": "2024-05-17T21:27:00Z"
}
```

### GET `/numbers/{numberId}/qr`
- Retrieve current QR code (base64 image) for scanning. Cached short-lived.
- Response `200` body:
```json
{
  "qr_png_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "expires_at": "2024-05-17T21:27:00Z"
}
```
- Errors:
  - `404` if number not found or onboarding complete.
  - `409` if session busy regenerating QR code.

### POST `/numbers/{numberId}/session/restart`
- Force session restart (e.g., after disconnect).
- Response `202` once restart job queued.
- Request body (optional):
```json
{
  "reason": "manual_reconnect",
  "requested_by": "128a3c0f-2c01-4e9b-8739-3080cc1a9c6d"
}
```
- Response:
```json
{
  "job_id": "5cc9c2f4-9e7e-4dac-b8c0-2b3e13dbce78",
  "status": "queued"
}
```

### DELETE `/numbers/{numberId}`
- Deregister number and archive session artifacts. Soft delete with retention policy.
- Response `202` with `{ "status": "archiving" }` if asynchronous cleanup kicks off.

## 5. Bot Configurations
**Data model alignment:** `bots` holds stable metadata, with `bot_versions` tracking drafts/published flows and `bot_number_deployments` capturing which numbers run which version. Publishing flips `bot_versions.status` and updates `bots.current_version_id`.
**Entity: BotConfig**
- `id` (UUID).
- `name` (string, 3-64 chars).
- `description` (string, optional, max 256 chars).
- `version` (integer, auto-increment per publish).
- `status` (enum: `draft`, `published`, `archived`).
- `flow_definition` (JSON object matching FlowSchema v1).
- `created_by` / `updated_by` (UUID).
- `created_at` / `updated_at` (ISO 8601).
- `published_at` (ISO 8601 | null).

### GET `/bots`
- List bot configurations with metadata (name, version, status, assigned numbers).
- Query params: `status`, `search`, `assignedNumberId`.
- Response `200` body:
```json
{
  "data": [
    {
      "id": "703b03e4-004d-4b16-8a78-3ae918649161",
      "name": "Lead Capture v2",
      "version": 4,
      "status": "published",
      "description": "Captures lead details and pushes to CRM",
      "assigned_numbers": ["9c6f5a54-92cd-4e3c-8bd2-5fda5c1b5c61"],
      "tags": ["leads", "crm"]
    }
  ],
  "cursor": null
}
```

### POST `/bots`
- Create new bot config draft. Payload: high-level metadata + JSON flow definition reference.
- Request body:
```json
{
  "name": "Lead Capture",
  "description": "Collects contact info and sends notification email",
  "tags": ["leads"],
  "flow_definition": {
    "version": "1.0",
    "trigger": { "type": "keyword", "keywords": ["lead", "signup"] },
    "steps": [
      {
        "id": "ask_name",
        "type": "collect",
        "prompt": { "default": "Hi! What's your name?" },
        "capture_key": "name",
        "validation": { "required": true }
      },
      {
        "id": "notify_webhook",
        "type": "webhook",
        "config": { "integration_id": "d7eb8acd-80dd-4e9a-a8d7-d21a22fcb0d1" }
      }
    ],
    "fallback": { "type": "handoff", "target": "human_agent" }
  }
}
```
- Validation:
  - `name`: required, unique per organization.
  - `flow_definition`: must conform to FlowSchema v1 (define separately).
- Response `201`:
```json
{
  "id": "703b03e4-004d-4b16-8a78-3ae918649161",
  "status": "draft",
  "version": 1
}
```

### GET `/bots/{botId}`
- Retrieve specific bot config with version history.
- Response `200`:
```json
{
  "id": "703b03e4-004d-4b16-8a78-3ae918649161",
  "name": "Lead Capture",
  "description": "Collects contact info and sends notification email",
  "current_version": {
    "version": 2,
    "status": "published",
    "flow_definition": {},
    "published_at": "2024-05-12T18:43:12Z"
  },
  "history": [
    {
      "version": 1,
      "status": "archived",
      "published_at": "2024-04-01T08:00:00Z"
    }
  ]
}
```

### PUT `/bots/{botId}`
- Update draft config. Reject if status is `published`.
- Request body mirrors `POST /bots` but partial updates allowed; include `version` to enforce optimistic locking.
- Response `200` with updated draft payload.
- Errors:
  - `409` if attempting to edit published version.
  - `412` if version precondition fails.

### POST `/bots/{botId}/publish`
- Promote draft to published version; payload optionally includes change summary.
- Request body:
```json
{
  "version": 3,
  "change_summary": "Added webhook retry logic",
  "scheduled_at": null
}
```
- Response `200`:
```json
{
  "id": "703b03e4-004d-4b16-8a78-3ae918649161",
  "version": 3,
  "status": "published",
  "published_at": "2024-05-20T09:15:00Z"
}
```
- Errors:
  - `400` if no draft available.
  - `409` if another publish in progress.

### POST `/bots/{botId}/clone`
- Duplicate bot config to new draft (for branching).
- Response `201`:
```json
{
  "id": "0f96c53b-5776-4d83-aac9-3f8b8e59f226",
  "source_bot_id": "703b03e4-004d-4b16-8a78-3ae918649161",
  "status": "draft",
  "version": 1
}
```

## 6. Action Templates Library
**Data model alignment:** `action_templates` stores template shells (`is_system` distinguishes built-ins) while `action_template_versions` carries versioned input/output schemas and status flags surfaced by these endpoints.
### GET `/actions`
- List available action templates (lead capture, FAQ, webhooks).

### POST `/actions`
- Register custom action template. Admin-only.

### GET `/actions/{actionId}`
- Fetch template schema, required inputs, output mappings.

### PATCH `/actions/{actionId}`
- Update template metadata or schema (draft/published versions).

## 7. Conversation Management
**Data model alignment:** Conversations persist in `conversations`; message history in `messages`; tags/notes/exports in `conversation_tags`, `conversation_notes`, and `conversation_exports`. API filters should align with indexes on `number_id`, `status`, and `last_message_at`.
### GET `/conversations`
- Query conversation transcripts with filters (number, bot, status, date range, keyword).

### GET `/conversations/{conversationId}`
- Detailed transcript with message timeline, action outputs, tags.

### POST `/conversations/{conversationId}/tags`
- Apply manual tags/notes for future reference.

### POST `/conversations/export`
- Kick off export job; payload defines filter + destination (download/email/storage).

## 8. Analytics & Metrics
**Data model alignment:** Powered by `analytics_events` for raw metrics and `alerts` for surfaced incidents. Consider Postgres views or materialized views to pre-aggregate heavy queries.
### GET `/analytics/summary`
- High-level metrics (messages processed, active users, conversion events) over timeframe.

### GET `/analytics/actions`
- Aggregated action outcomes (e.g., leads captured per action).

### GET `/analytics/health`
- Operational health indicators: session status, error counts, latency percentiles.

## 9. Audit & Activity
**Data model alignment:** `audit_log_entries` captures user/system actions; `alerts` feeds monitoring dashboards. RLS should limit audit visibility to admin-capable roles.
### GET `/audit/logs`
- Retrieve paginated audit trail entries (who changed what, when).

### GET `/alerts`
- Fetch active alerts/incidents generated by monitoring subsystem.

## 10. Webhooks & Integrations
**Data model alignment:** `integrations` manages configuration, `integration_events` retains sync/test results, and `webhook_subscriptions` maps bot events to destination URLs. Secrets remain references to the external secret manager.
### GET `/integrations`
- List configured downstream integrations (webhooks, CRMs, sheets).

### POST `/integrations`
- Create integration configuration; payload includes type, credentials reference, mapping.

### GET `/integrations/{integrationId}`
- Details of integration including status and last sync timestamp.

### POST `/integrations/{integrationId}/test`
- Trigger test call to validate connectivity.

## 11. System Utilities
**Data model alignment:** Feature toggle endpoints read/write `feature_flags` and `feature_flag_overrides`. `/status` can enrich DB-derived info with runtime health but should, at minimum, surface DB connectivity.
### GET `/status`
- Service heartbeat info (version, dependencies health). Used by monitoring/ops UI.

### GET `/feature-flags`
- Retrieve active feature toggles for admin UI gating.

---

> **Next steps:** Flesh out schemas (request/response models), validation rules, and error codes; consider generating full OpenAPI spec once endpoints stabilize.
