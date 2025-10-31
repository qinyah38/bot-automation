# Data Model

This document captures the initial relational schema for the Supabase (Postgres) deployment that powers runtime orchestration and the admin experience. It aligns with the API surface outlined in `docs/api.md`; each API group now calls out the tables it touches so migrations and handlers stay in sync with this design. The schema also supports the architecture plan in `docs/architecture.md`.

## Conventions
- **IDs** – `uuid` primary keys generated via `gen_random_uuid()`.
- **Timestamps** – `timestamptz` with `NOW()` defaults; all dates are stored in UTC.
- **JSON payloads** – leverage `jsonb` for schemaless configuration blobs, response payloads, and analytics data.
- **Soft deletes** – modelled with `archived_at` / `deleted_at` rather than physical deletes where historical traceability matters.
- **Enums** – implemented as Postgres enums (`CREATE TYPE`) or constrained `text` columns with `CHECK` constraints when the set may evolve rapidly.

## Identity & Access

### `users`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `email` | citext (unique) | Canonical login; enforce lowercase uniqueness. |
| `display_name` | text | Shown in UI and audit logs. |
| `status` | user_status enum | `active`, `pending_invite`, `suspended`. |
| `last_login_at` | timestamptz | Updated on successful auth. |
| `metadata` | jsonb | Provider IDs, MFA flags, locale. |
| `created_at` / `updated_at` | timestamptz | Default `NOW()`. |

### `roles`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `key` | text (unique) | e.g. `admin`, `editor`, `viewer`. |
| `description` | text | Human readable purpose. |
| `created_at` | timestamptz | |

### `user_roles`
| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid FK → `users.id` | |
| `role_id` | uuid FK → `roles.id` | |
| `assigned_by` | uuid FK → `users.id` | Null for system bootstrap. |
| `created_at` | timestamptz | |

Composite PK on (`user_id`, `role_id`). Enforce RLS so users only see members in their organization (single-tenant today).

### `api_tokens`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | |
| `name` | text | Label shown in UI. |
| `hashed_secret` | text | Bcrypt hash; raw secret shown once. |
| `last_used_at` | timestamptz | |
| `expires_at` | timestamptz | Null for non-expiring. |
| `scopes` | text[] | Optional scope restriction. |
| `created_at` | timestamptz | |

## Bots & Configuration Library

### `bots`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text | Unique per workspace. |
| `description` | text | |
| `default_locale` | text | e.g. `en-US`. |
| `owner_id` | uuid FK → `users.id` | |
| `current_version_id` | uuid FK → `bot_versions.id` | Denormalized pointer for quick lookups. |
| `archived_at` | timestamptz | Null when active. |
| `created_at` / `updated_at` | timestamptz | |

### `bot_versions`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `bot_id` | uuid FK → `bots.id` | |
| `version_number` | int | Auto-increment per bot. |
| `status` | bot_version_status enum | `draft`, `published`, `archived`. |
| `flow_definition` | jsonb | DSL describing triggers, steps, branching. |
| `validation_errors` | jsonb | Captured on failed validation runs. |
| `change_summary` | text | Optional release notes. |
| `created_by` | uuid FK → `users.id` | |
| `published_at` | timestamptz | Null until status = `published`. |
| `created_at` / `updated_at` | timestamptz | |

Unique index on (`bot_id`, `version_number`). Add partial index on (`status`) WHERE `status = 'published'` for fast lookup of live versions.

### `number_bot_deployments`
Records each time a WhatsApp number is bound to a bot version.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `number_id` | uuid FK → `numbers.id` | |
| `bot_version_id` | uuid FK → `bot_versions.id` | |
| `assigned_by` | uuid FK → `users.id` | |
| `status` | deployment_status enum | `active`, `superseded`, `rolled_back`. |
| `effective_at` | timestamptz | When runtime picked up change. |
| `ended_at` | timestamptz | Null while active. |
| `notes` | text | Deployment rationale. |
| `created_at` | timestamptz | |

### `action_templates`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | text (unique) | e.g. `lead_capture`, `faq_lookup`. |
| `name` | text | Display label. |
| `category` | text | Grouping for UI; consider enum. |
| `description` | text | |
| `is_system` | boolean | `true` for built-in templates. |
| `created_by` | uuid FK → `users.id` | |
| `created_at` / `updated_at` | timestamptz | |

### `action_template_versions`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `action_template_id` | uuid FK → `action_templates.id` | |
| `version_number` | int | |
| `status` | template_version_status enum | `draft`, `published`, `deprecated`. |
| `input_schema` | jsonb | JSON Schema for configuration inputs. |
| `output_schema` | jsonb | Defines structured outputs runtime should emit. |
| `ui_schema` | jsonb | Optional UI hints for form builders. |
| `sample_payload` | jsonb | Example request/response for docs/tests. |
| `metadata` | jsonb | Environment-specific overrides. |
| `created_at` / `updated_at` | timestamptz | |

## WhatsApp Numbers & Sessions

### `numbers`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `phone_number` | text (unique) | Stored in E.164. |
| `display_name` | text | |
| `region` | text | ISO 3166-1 alpha-2. |
| `owner_id` | uuid FK → `users.id` | Optional steward. |
| `status` | number_status enum | `pending_qr`, `connected`, `disconnected`, `suspended`. |
| `active_deployment_id` | uuid FK → `number_bot_deployments.id` | Null if no bot mapped. |
| `last_connected_at` | timestamptz | |
| `notes` | text | |
| `created_at` / `updated_at` | timestamptz | |

Partial indexes on `status` and `owner_id` support API filters.

### `number_sessions`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `number_id` | uuid FK → `numbers.id` (unique) | 1:1 with number. |
| `session_state` | session_state enum | `pending_qr`, `ready`, `reconnecting`, `error`. |
| `qr_token` | text | Cached WhatsApp QR token. |
| `qr_expires_at` | timestamptz | |
| `session_file_path` | text | Encrypted volume path. |
| `last_error` | text | Most recent failure reason. |
| `runtime_metadata` | jsonb | Device info, WA IDs, capabilities. |
| `updated_at` | timestamptz | |

### `number_connection_events`
Append-only log for observability.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial PK | |
| `number_id` | uuid FK → `numbers.id` | |
| `event_type` | text | `connected`, `disconnected`, `qr_regenerated`, etc. |
| `payload` | jsonb | Raw runtime payload. |
| `created_at` | timestamptz | Default `NOW()`. |

## Conversations & Messaging

### `conversations`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `number_id` | uuid FK → `numbers.id` | |
| `bot_version_id` | uuid FK → `bot_versions.id` | Version at session start. |
| `customer_wa_id` | text | WhatsApp JID for participant. |
| `status` | conversation_status enum | `open`, `snoozed`, `closed`. |
| `opened_at` | timestamptz | Defaults to first message time. |
| `closed_at` | timestamptz | |
| `last_message_at` | timestamptz | |
| `current_state` | jsonb | Bot state machine snapshot. |
| `metadata` | jsonb | Channel tags, lead source, etc. |
| `created_at` / `updated_at` | timestamptz | |

Index `conversations` on (`number_id`, `status`) and `last_message_at` for listing screens.

### `messages`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `conversation_id` | uuid FK → `conversations.id` | |
| `direction` | message_direction enum | `inbound`, `outbound`, `system`. |
| `message_type` | text | `text`, `media`, `interactive`, `event`. |
| `payload` | jsonb | WhatsApp message payload. |
| `sent_at` | timestamptz | |
| `delivery_status` | text | `pending`, `sent`, `delivered`, `failed`. |
| `error_details` | jsonb | Populated when delivery fails. |
| `integration_context` | jsonb | Data captured from webhook/action triggers. |
| `created_at` | timestamptz | |

Partition by month (native declarative partitioning) once volume grows beyond a few million rows.

### `conversation_tags`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `conversation_id` | uuid FK → `conversations.id` | |
| `tag` | text | Lowercase slug; add index for search. |
| `applied_by` | uuid FK → `users.id` | |
| `created_at` | timestamptz | |

### `conversation_notes`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `conversation_id` | uuid FK → `conversations.id` | |
| `body` | text | Markdown-friendly. |
| `visibility` | text | `internal`, `shared`. |
| `author_id` | uuid FK → `users.id` | |
| `created_at` | timestamptz | |

### `conversation_exports`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `requested_by` | uuid FK → `users.id` | |
| `filter` | jsonb | Snapshot of query parameters. |
| `destination_type` | text | `download`, `email`, `storage`. |
| `status` | export_status enum | `queued`, `running`, `succeeded`, `failed`. |
| `result_location` | text | Presigned URL or storage path. |
| `error_details` | jsonb | |
| `created_at` / `updated_at` | timestamptz | |
| `completed_at` | timestamptz | |

## Integrations & Webhooks

### `integrations`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `type` | text | `webhook`, `crm_hubspot`, `google_sheets`, etc. |
| `display_name` | text | |
| `status` | integration_status enum | `active`, `disabled`, `error`. |
| `config` | jsonb | Non-secret configuration (endpoints, mappings). |
| `secret_reference` | text | Pointer to secrets manager entry. |
| `last_sync_at` | timestamptz | |
| `last_error_at` | timestamptz | |
| `created_by` | uuid FK → `users.id` | |
| `created_at` / `updated_at` | timestamptz | |

### `integration_events`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial PK | |
| `integration_id` | uuid FK → `integrations.id` | |
| `event_type` | text | `sync_started`, `sync_succeeded`, `sync_failed`, etc. |
| `payload` | jsonb | Request/response snapshots, errors. |
| `created_at` | timestamptz | |

### `webhook_subscriptions`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `bot_id` | uuid FK → `bots.id` | |
| `integration_id` | uuid FK → `integrations.id` | Optional if using general webhook. |
| `event` | text | `conversation.created`, `message.sent`, etc. |
| `target_url` | text | Destination endpoint. |
| `headers` | jsonb | Custom headers (redact secrets). |
| `status` | text | `active`, `paused`. |
| `retry_policy` | jsonb | Max attempts, backoff. |
| `created_at` / `updated_at` | timestamptz | |

## Observability & Analytics

### `analytics_events`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial PK | |
| `occurred_at` | timestamptz | Event timestamp. |
| `event_type` | text | e.g. `message_processed`, `conversion_recorded`. |
| `bot_id` | uuid FK → `bots.id` | Nullable for system metrics. |
| `number_id` | uuid FK → `numbers.id` | |
| `conversation_id` | uuid FK → `conversations.id` | Nullable for aggregate-only events. |
| `payload` | jsonb | Arbitrary structured metrics. |
| `ingested_at` | timestamptz | Default `NOW()`. |

Partition by month; replicate to analytics warehouse as needed.

### `alerts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `type` | text | `runtime_disconnect`, `integration_failure`, etc. |
| `severity` | text | `info`, `warning`, `critical`. |
| `status` | alert_status enum | `open`, `acknowledged`, `resolved`. |
| `context` | jsonb | Structured details for UI. |
| `triggered_at` | timestamptz | |
| `resolved_at` | timestamptz | |
| `resolved_by` | uuid FK → `users.id` | Nullable. |

## Audit & Compliance

### `audit_log_entries`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial PK | |
| `actor_type` | text | `user`, `system`. |
| `actor_id` | uuid | FK to `users.id` when applicable. |
| `action` | text | `bot.publish`, `number.assign_bot`, etc. |
| `target_type` | text | |
| `target_id` | uuid | Nullable for aggregate actions. |
| `metadata` | jsonb | Request context, diffs, IP, user agent. |
| `created_at` | timestamptz | |

RLS should enforce read access by admins only. Index on `created_at DESC` for timeline views.

## Feature Flags & Configuration

### `feature_flags`
| Column | Type | Notes |
| --- | --- | --- |
| `key` | text PK | |
| `description` | text | |
| `default_value` | boolean | |
| `metadata` | jsonb | Ramp rules, UI hints. |
| `created_at` | timestamptz | |

### `feature_flag_overrides`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `flag_key` | text FK → `feature_flags.key` | |
| `target_type` | text | `user`, `role`, `number`. |
| `target_id` | uuid | |
| `value` | boolean | |
| `created_by` | uuid FK → `users.id` | |
| `created_at` | timestamptz | |

## Relationships Overview
- **Users ↔ Roles** – many-to-many through `user_roles`; admins manage membership.
- **Bots ↔ Bot Versions** – one-to-many; numbers bind to specific published versions via `number_bot_deployments`.
- **Numbers ↔ Sessions** – one-to-one record storing runtime state. Historical connectivity captured in `number_connection_events`.
- **Numbers ↔ Conversations ↔ Messages** – numbers spawn many conversations; conversations hold ordered messages and related tags/notes.
- **Bots ↔ Integrations** – optional association through `webhook_subscriptions` and action configuration stored in `flow_definition`.
- **Audit trail** – `audit_log_entries` reference actors and targets across domains for compliance reviews.

## Open Questions / Future Enhancements
- **Multi-tenant isolation** – introduce `organizations` table with FK on all major entities once external customers onboard; use RLS scoped by `org_id`.
- **Schema migrations** – decide on toolchain (Supabase migrations vs. external migrations repo) and codify naming conventions.
- **Session storage encryption** – clarify whether `session_file_path` is sufficient or if hashed references are required to avoid leaking locations across tenants.
- **Analytics warehouse** – once event volume grows, replicate `analytics_events` to Parquet/S3 or external warehouse and prune raw data from OLTP.
