-- Supabase schema snapshot generated from docs/data-model.md and runtime usage.
-- Run with psql or supabase db remote commit to bootstrap another Postgres-compatible provider.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'pending_invite', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bot_version_status') THEN
    CREATE TYPE bot_version_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deployment_status') THEN
    CREATE TYPE deployment_status AS ENUM ('active', 'superseded', 'rolled_back');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_version_status') THEN
    CREATE TYPE template_version_status AS ENUM ('draft', 'published', 'deprecated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'number_status') THEN
    CREATE TYPE number_status AS ENUM ('pending_qr', 'connected', 'disconnected', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_state') THEN
    CREATE TYPE session_state AS ENUM ('pending_qr', 'ready', 'reconnecting', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
    CREATE TYPE conversation_status AS ENUM ('open', 'snoozed', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'export_status') THEN
    CREATE TYPE export_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_status') THEN
    CREATE TYPE integration_status AS ENUM ('active', 'disabled', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
    CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  status user_status NOT NULL DEFAULT 'pending_invite',
  last_login_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  hashed_secret text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  default_locale text,
  owner_id uuid REFERENCES users(id),
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS bot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status bot_version_status NOT NULL DEFAULT 'draft',
  flow_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_errors jsonb,
  change_summary text,
  created_by uuid REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (bot_id, version_number)
);

CREATE TABLE IF NOT EXISTS action_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS action_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_template_id uuid NOT NULL REFERENCES action_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status template_version_status NOT NULL DEFAULT 'draft',
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb,
  ui_schema jsonb,
  sample_payload jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (action_template_id, version_number)
);

CREATE TABLE IF NOT EXISTS numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  display_name text,
  region text,
  owner_id uuid REFERENCES users(id),
  status number_status NOT NULL DEFAULT 'pending_qr',
  active_deployment_id uuid,
  last_connected_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS number_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid NOT NULL UNIQUE REFERENCES numbers(id) ON DELETE CASCADE,
  session_state session_state NOT NULL DEFAULT 'pending_qr',
  qr_token text,
  qr_expires_at timestamptz,
  session_file_path text,
  last_error text,
  runtime_metadata jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS number_connection_events (
  id bigserial PRIMARY KEY,
  number_id uuid NOT NULL REFERENCES numbers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS number_bot_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid NOT NULL REFERENCES numbers(id) ON DELETE CASCADE,
  bot_version_id uuid REFERENCES bot_versions(id),
  assigned_by uuid REFERENCES users(id),
  status deployment_status NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid NOT NULL REFERENCES numbers(id) ON DELETE CASCADE,
  bot_version_id uuid REFERENCES bot_versions(id),
  customer_wa_id text NOT NULL,
  status conversation_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  closed_at timestamptz,
  last_message_at timestamptz,
  current_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_number_customer_idx
  ON conversations (number_id, customer_wa_id)
  WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  delivery_status text,
  error_details jsonb,
  integration_context jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS conversation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tag text NOT NULL,
  applied_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (conversation_id, tag)
);

CREATE TABLE IF NOT EXISTS conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal',
  author_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS conversation_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES users(id),
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination_type text NOT NULL,
  status export_status NOT NULL DEFAULT 'queued',
  result_location text,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  display_name text NOT NULL,
  status integration_status NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_reference text,
  last_sync_at timestamptz,
  last_error_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS integration_events (
  id bigserial PRIMARY KEY,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES bots(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  event text NOT NULL,
  target_url text NOT NULL,
  headers jsonb,
  status text NOT NULL DEFAULT 'active',
  retry_policy jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  event_type text NOT NULL,
  bot_id uuid REFERENCES bots(id),
  number_id uuid REFERENCES numbers(id),
  conversation_id uuid REFERENCES conversations(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL,
  status alert_status NOT NULL DEFAULT 'open',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log_entries (
  id bigserial PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  description text,
  default_value boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  value boolean NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (flag_key, target_type, target_id)
);

ALTER TABLE numbers
  ADD CONSTRAINT numbers_active_deployment_fkey
  FOREIGN KEY (active_deployment_id) REFERENCES number_bot_deployments(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_numbers_status ON numbers(status);
CREATE INDEX IF NOT EXISTS idx_numbers_owner_id ON numbers(owner_id);
CREATE INDEX IF NOT EXISTS idx_number_bot_deployments_number ON number_bot_deployments(number_id);
CREATE INDEX IF NOT EXISTS idx_conversations_number_status ON conversations(number_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_conversation ON conversation_notes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_exports_status ON conversation_exports(status);
CREATE INDEX IF NOT EXISTS idx_integration_events_integration ON integration_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_bot ON webhook_subscriptions(bot_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_bot ON analytics_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_number ON analytics_events(number_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_entries_created_at ON audit_log_entries(created_at DESC);
