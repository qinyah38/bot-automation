export type ModuleFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "toggle"
  | "keyword-list"
  | "multiselect";

export type ModuleField = {
  key: string;
  label: string;
  type: ModuleFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  pattern?: RegExp;
  errorMessage?: string;
};

export type FlowModuleDefinition = {
  id: string;
  name: string;
  category: "collection" | "workflow";
  description: string;
  defaultSummary: string;
  defaultStatus?: "Draft" | "Configured" | "Ready";
  defaultConfig?: Record<string, unknown>;
  fields: ModuleField[];
};

export type TriggerModuleDefinition = {
  id: string;
  name: string;
  description: string;
  defaultDetail: string;
  defaultConfig?: Record<string, unknown>;
  fields: ModuleField[];
};

export type IntegrationToggleDefinition = {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  fields?: ModuleField[];
};

export const flowModuleCatalog: FlowModuleDefinition[] = [
  {
    id: "collect_text",
    name: "Collect text",
    category: "collection",
    description: "Prompt the user for free-form text with optional validation rules.",
    defaultSummary: "Collects text input from the user.",
    defaultStatus: "Draft",
    defaultConfig: {
      prompt: "",
      answerKey: "",
      validators: [],
      retryMessage: "",
      placeholder: "",
    },
    fields: [
      {
        key: "prompt",
        label: "Prompt",
        type: "textarea",
        required: true,
        errorMessage: "Prompt is required",
        placeholder: "📝 اكتب اسمك الثلاثي (بالعربي):",
      },
      {
        key: "answerKey",
        label: "Answer key",
        type: "text",
        required: true,
        errorMessage: "Answer key is required",
        description: "Unique key used to store this answer.",
      },
      {
        key: "validators",
        label: "Validators",
        type: "multiselect",
        options: [
          { label: "Required", value: "required" },
          { label: "Arabic text", value: "arabic_text" },
          { label: "Email", value: "email" },
          { label: "Phone", value: "phone" },
        ],
      },
      {
        key: "retryMessage",
        label: "Retry message",
        type: "textarea",
        placeholder: "⚠️ الرجاء إدخال نص عربي صحيح.",
      },
      {
        key: "placeholder",
        label: "Placeholder",
        type: "text",
      },
    ],
  },
  {
    id: "collect_number",
    name: "Collect number",
    category: "collection",
    description: "Capture an integer-like response, supporting Arabic numerals.",
    defaultSummary: "Collects a numeric answer within a defined range.",
    defaultStatus: "Draft",
    defaultConfig: {
      prompt: "",
      answerKey: "",
      min: null,
      max: null,
      retryMessage: "",
      storeAs: "number",
    },
    fields: [
      {
        key: "prompt",
        label: "Prompt",
        type: "textarea",
        required: true,
        errorMessage: "Prompt is required",
      },
      {
        key: "answerKey",
        label: "Answer key",
        type: "text",
        required: true,
        errorMessage: "Answer key is required",
      },
      { key: "min", label: "Minimum", type: "number" },
      { key: "max", label: "Maximum", type: "number" },
      {
        key: "retryMessage",
        label: "Retry message",
        type: "textarea",
      },
      {
        key: "storeAs",
        label: "Store as",
        type: "select",
        options: [
          { label: "Number", value: "number" },
          { label: "String", value: "string" },
        ],
        defaultValue: "number",
      },
    ],
  },
  {
    id: "collect_choice",
    name: "Collect choice",
    category: "collection",
    description: "Provide a list of options with optional 'other' input.",
    defaultSummary: "Captures a choice or custom response.",
    defaultStatus: "Draft",
    defaultConfig: {
      prompt: "",
      answerKey: "",
      choices: [],
      allowOther: false,
      multiselect: false,
      retryMessage: "",
    },
    fields: [
      {
        key: "prompt",
        label: "Prompt",
        type: "textarea",
        required: true,
        errorMessage: "Prompt is required",
      },
      {
        key: "answerKey",
        label: "Answer key",
        type: "text",
        required: true,
        errorMessage: "Answer key is required",
      },
      {
        key: "choices",
        label: "Choices",
        type: "textarea",
        description: "One option per line.",
      },
      {
        key: "allowOther",
        label: "Allow other input",
        type: "toggle",
      },
      {
        key: "multiselect",
        label: "Allow multiple selections",
        type: "toggle",
      },
      { key: "retryMessage", label: "Retry message", type: "textarea" },
    ],
  },
  {
    id: "collect_yes_no",
    name: "Collect yes/no",
    category: "collection",
    description: "Quick confirmation module returning a boolean.",
    defaultSummary: "Captures a yes/no decision.",
    defaultStatus: "Draft",
    defaultConfig: {
      prompt: "",
      answerKey: "",
      yesLabel: "Yes",
      noLabel: "No",
      retryMessage: "",
    },
    fields: [
      {
        key: "prompt",
        label: "Prompt",
        type: "textarea",
        required: true,
        errorMessage: "Prompt is required",
      },
      {
        key: "answerKey",
        label: "Answer key",
        type: "text",
        required: true,
        errorMessage: "Answer key is required",
      },
      { key: "yesLabel", label: "Yes label", type: "text" },
      { key: "noLabel", label: "No label", type: "text" },
      { key: "retryMessage", label: "Retry message", type: "textarea" },
    ],
  },
  {
    id: "send_message",
    name: "Send message",
    category: "workflow",
    description: "Send a static outbound message, optionally with media or buttons.",
    defaultSummary: "Sends a predefined message to the user.",
    defaultStatus: "Draft",
    defaultConfig: {
      type: "text",
      body: "",
      mediaUrl: "",
      buttons: [],
      footer: "",
    },
    fields: [
      {
        key: "type",
        label: "Message type",
        type: "select",
        options: [
          { label: "Text", value: "text" },
          { label: "Image", value: "image" },
          { label: "Document", value: "document" },
        ],
        defaultValue: "text",
      },
      {
        key: "body",
        label: "Message body",
        type: "textarea",
        required: true,
        errorMessage: "Message body is required",
      },
      {
        key: "mediaUrl",
        label: "Media URL",
        type: "text",
        pattern: /^https?:\/\//,
        errorMessage: "Enter a valid URL",
      },
      { key: "buttons", label: "Buttons (JSON)", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "delay",
    name: "Delay",
    category: "workflow",
    description: "Pause before continuing to the next module.",
    defaultSummary: "Delays the conversation for a set duration.",
    defaultStatus: "Draft",
    defaultConfig: {
      durationSeconds: 2,
      typingIndicator: true,
    },
    fields: [
      {
        key: "durationSeconds",
        label: "Duration (seconds)",
        type: "number",
        required: true,
        min: 0,
        errorMessage: "Duration must be zero or greater",
      },
      {
        key: "typingIndicator",
        label: "Show typing indicator",
        type: "toggle",
        defaultValue: true,
      },
    ],
  },
  {
    id: "branch_on_answer",
    name: "Branch on answer",
    category: "workflow",
    description: "Route the flow based on a previously captured answer.",
    defaultSummary: "Branches depending on the chosen answer.",
    defaultStatus: "Draft",
    defaultConfig: {
      sourceKey: "",
      branches: [],
      defaultNext: "",
    },
    fields: [
      {
        key: "sourceKey",
        label: "Source answer key",
        type: "text",
        required: true,
        errorMessage: "Source key is required",
      },
      {
        key: "branches",
        label: "Branches",
        type: "textarea",
        description: "Define match → next step pairs in JSON or bullet format.",
      },
      {
        key: "defaultNext",
        label: "Default step",
        type: "text",
        description: "Fallback next step id.",
      },
    ],
  },
  {
    id: "save_submission",
    name: "Save submission",
    category: "workflow",
    description: "Persist collected answers to storage or pass to downstream modules.",
    defaultSummary: "Saves the answers to Supabase or forwards them.",
    defaultStatus: "Ready",
    defaultConfig: {
      destination: "supabase.submissions",
      fields: {},
      includeMeta: true,
      notes: "",
    },
    fields: [
      {
        key: "destination",
        label: "Destination",
        type: "select",
        required: true,
        errorMessage: "Destination is required",
        options: [
          { label: "Supabase submissions table", value: "supabase.submissions" },
          { label: "Webhook only", value: "webhook-only" },
        ],
        defaultValue: "supabase.submissions",
      },
      {
        key: "fields",
        label: "Field mapping (JSON)",
        type: "textarea",
      },
      {
        key: "includeMeta",
        label: "Include session metadata",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
      },
    ],
  },
  {
    id: "webhook_call",
    name: "Webhook call",
    category: "workflow",
    description: "Invoke an external HTTP endpoint with the collected data.",
    defaultSummary: "Calls a webhook with the collected payload.",
    defaultStatus: "Draft",
    defaultConfig: {
      url: "",
      method: "POST",
      bodyTemplate: {},
      headers: {},
      authSecretEnv: "",
      retryPolicy: "linear",
      timeoutMs: 5000,
    },
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        required: true,
        pattern: /^https?:\/\//,
        errorMessage: "Enter a valid URL",
      },
      {
        key: "method",
        label: "Method",
        type: "select",
        options: [
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
          { label: "PATCH", value: "PATCH" },
        ],
        defaultValue: "POST",
      },
      {
        key: "bodyTemplate",
        label: "Body template (JSON)",
        type: "textarea",
        description: "Use templating variables like {{answers.full_name}}.",
      },
      { key: "headers", label: "Headers (JSON)", type: "textarea" },
      { key: "authSecretEnv", label: "Auth secret env var", type: "text" },
      {
        key: "retryPolicy",
        label: "Retry policy",
        type: "select",
        options: [
          { label: "None", value: "none" },
          { label: "Linear", value: "linear" },
          { label: "Exponential", value: "exponential" },
        ],
        defaultValue: "linear",
      },
      {
        key: "timeoutMs",
        label: "Timeout (ms)",
        type: "number",
        defaultValue: 5000,
      },
    ],
  },
];

export const triggerModuleCatalog: TriggerModuleDefinition[] = [
  {
    id: "start_command",
    name: "Start command",
    description: "Require users to send a specific slash command to begin.",
    defaultDetail: "Users send /start to begin the flow.",
    defaultConfig: { command: "/start" },
    fields: [
      {
        key: "command",
        label: "Command",
        type: "text",
        required: true,
        placeholder: "/start",
      },
    ],
  },
  {
    id: "keyword_match",
    name: "Keyword match",
    description: "Start when a message contains any configured keyword.",
    defaultDetail: "Activated when a keyword is detected in the message.",
    defaultConfig: { keywords: ["lead", "signup"] },
    fields: [
      {
        key: "keywords",
        label: "Keywords",
        type: "keyword-list",
        required: true,
        description: "Separate keywords with commas.",
      },
    ],
  },
  {
    id: "greeting_hala",
    name: "“هلا” greeting",
    description: "Start when user sends هلا or stretched variations.",
    defaultDetail: "Triggered by هلا-style greetings.",
    defaultConfig: { enabled: true },
    fields: [],
  },
  {
    id: "webhook_invoke",
    name: "Webhook invoke",
    description: "External system triggers conversations via signed webhook.",
    defaultDetail: "Triggered by an external webhook call.",
    defaultConfig: { secretEnv: "", payloadSchemaRef: "" },
    fields: [
      { key: "secretEnv", label: "Secret env variable", type: "text" },
      {
        key: "payloadSchemaRef",
        label: "Payload schema",
        type: "text",
        description: "Reference to JSON schema stored in the catalog.",
      },
    ],
  },
];

export const integrationToggleCatalog: IntegrationToggleDefinition[] = [
  {
    id: "analytics",
    label: "Mirror to analytics lake",
    description: "Send structured events to the warehouse for BI dashboards.",
    defaultEnabled: true,
  },
  {
    id: "crm-notify",
    label: "Notify CRM webhook",
    description: "Invoke the configured webhook for every new submission.",
    defaultEnabled: true,
  },
  {
    id: "alerting",
    label: "Alert on disconnects",
    description: "Send Slack alert if the assigned number disconnects.",
    defaultEnabled: false,
  },
];
