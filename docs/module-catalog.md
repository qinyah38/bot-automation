# Module Catalog (Admin-Fillable Modules)

The goal for v0 is to ship with a curated set of runtime modules that admins can configure without writing code. Each module exposes a predictable schema so the builder UI can render forms directly from these definitions. The live catalog powering the frontend sits at `admin-ui/src/data/module-catalog.ts`.

## 1. Conversational Collection Modules

| Module ID | Purpose | Required Config | Optional Config | Output |
|-----------|---------|-----------------|-----------------|--------|
| `collect_text` | Prompt user for free-form text. | `prompt` (string), `answerKey` (string) | `validators` (array of enum: `arabic_text`, `email`, `phone`, `required`), `placeholder`, `retryMessage`, `maxLength`. | `answers[answerKey] = string` |
| `collect_number` | Capture integer-like responses (supports Arabic digits). | `prompt`, `answerKey` | `min`, `max`, `retryMessage`, `storeAs` (`number` or `string`). | `answers[answerKey] = number|string` |
| `collect_choice` | Provide a list of options with optional “other” entry. | `prompt`, `answerKey`, `choices` (array of string) | `allowOther` (bool), `multiselect` (bool), `retryMessage`, `otherLabel`. | `answers[answerKey] = string | string[]` |
| `collect_yes_no` | Quick confirmation. | `prompt`, `answerKey` | `yesLabel`, `noLabel`, `retryMessage`. | `answers[answerKey] = boolean` |

## 2. Workflow Modules

| Module ID | Purpose | Required Config | Optional Config | Output |
|-----------|---------|-----------------|-----------------|--------|
| `save_submission` | Persist collected answers. | `destination` (enum: `supabase.submissions`, `webhook-only`), `fields` (map for renaming). | `includeMeta` (bool), `notes`. | Returns record ID (if DB). |
| `webhook_call` | POST structured payload to external service. | `url`, `method` (enum), `bodyTemplate` (JSON with templating), `headers` (map). | `authSecretEnv`, `retryPolicy` (enum: `none`, `linear`, `exponential`), `timeoutMs`. | Webhook response stored in `context.lastWebhook`. |
| `branch_on_answer` | Conditional routing based on previous answers. | `sourceKey`, `branches` (array of `{match: string|number|boolean|"*"; nextStepId}`) | `defaultNext`. | Controls next step ID. |
| `delay` | Wait before next message. | `durationSeconds` | `typingIndicator` (bool). | Schedules next step. |
| `send_message` | Send static message (text or media). | `message.type` (enum `text`, `image`, `document`), `message.body` or `message.mediaUrl`. | `buttons`, `footer`. | Adds outbound message to transcript. |

## 3. Triggers

| Trigger ID | Purpose | Config |
|------------|---------|--------|
| `start_command` | Requires user to send a specific command to start. | `{ command: "/start" }` |
| `keyword_match` | Starts when a message includes any configured keyword. | `{ keywords: string[] }` |
| `greeting_hala` | Accept “هلا” variations. | `{ enabled: true }` |
| `webhook_invoke` | External system triggers a conversation. | `{ secretEnv, payloadSchemaRef }` |

## 4. Integrations (Toggle Modules)

| ID | Purpose | Config |
|----|---------|--------|
| `analytics_mirror` | Stream structured events to analytics sink. | `{ enabled: boolean }` |
| `crm_notify` | Push summary payload to CRM post-submission. | `{ webhookModuleId, template }` |
| `disconnect_alert` | Slack/email notification when WhatsApp session drops. | `{ channel, throttleMinutes }` |

## 5. Backlog (Not in v0)
- Module builder UI (create/edit module definitions from the admin).
- Rich branching canvas with drag-and-drop.
- A/B test module (split traffic between variations).
- Translation module (auto translate prompts; depends on external API).

## 6. Implementation Notes
- Define schemas in code (e.g., Zod) that map directly to the config inputs above; the builder can render forms automatically.
- Store published module definitions in `action_template_versions` so future updates remain versioned.
- Runtime should validate config at load time and fail fast with clear errors for missing fields.
- Builder should treat modules as immutable for now: admins can select modules and fill config only; module creation stays in engineering backlog.
