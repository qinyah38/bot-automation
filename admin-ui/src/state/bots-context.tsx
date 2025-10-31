"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FlowModuleDefinition,
  IntegrationToggleDefinition,
  TriggerModuleDefinition,
  flowModuleCatalog,
  integrationToggleCatalog,
  triggerModuleCatalog,
} from "@/data/module-catalog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/state/auth-context";
import {
  publishBotResponseSchema,
  type PublishBotRequest,
} from "@/lib/publish-contract";

type BotStat = {
  label: string;
  value: string;
  delta: string;
};

type BotTrigger = {
  id: string;
  moduleId: string;
  name: string;
  detail: string;
  config: Record<string, unknown>;
};

type BotFlowStep = {
  id: string;
  moduleId: string;
  name: string;
  summary: string;
  status: "Draft" | "Configured" | "Ready";
  config: Record<string, unknown>;
};

type BotIntegration = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

type FlowDefinition = {
  triggers?: BotTrigger[];
  steps?: BotFlowStep[];
  integrations?: BotIntegration[];
  metadata?: Record<string, unknown>;
};

type BotActivity = {
  title: string;
  time: string;
  detail: string;
};

export type Bot = {
  id: string;
  name: string;
  status: "Draft" | "Published" | "Archived";
  updatedLabel: string;
  assignedNumbers: string[];
  version: number;
  locale: string;
  description: string;
  lastSync: string;
  stats: BotStat[];
  triggers: BotTrigger[];
  flowSteps: BotFlowStep[];
  integrations: BotIntegration[];
  changeSummary: string[];
  activity: BotActivity[];
  autoAssign: boolean;
};

type CreateBotInput = {
  name: string;
  locale: string;
  description: string;
  autoAssign: boolean;
};

type BotsContextValue = {
  bots: Bot[];
  createBot: (input: CreateBotInput) => Bot;
  updateBot: (id: string, updater: (bot: Bot) => Bot) => void;
  getBot: (id: string) => Bot | undefined;
  updateBotMetadata: (
    id: string,
    metadata: Pick<Bot, "name" | "description" | "locale">,
  ) => void;
  saveDraft: (id: string) => void;
  publishBot: (id: string) => Promise<void>;
  isPublishing: (id: string) => boolean;
  setBotNumberAssignment: (botId: string, numberId: string, assign: boolean) => void;
  addTrigger: (botId: string, moduleId: string) => void;
  removeTrigger: (botId: string, triggerId: string) => void;
  updateTriggerConfig: (
    botId: string,
    triggerId: string,
    config: Record<string, unknown>,
  ) => void;
  addFlowStep: (botId: string, moduleId: string) => void;
  removeFlowStep: (botId: string, flowStepId: string) => void;
  updateFlowStepConfig: (
    botId: string,
    flowStepId: string,
    config: Record<string, unknown>,
  ) => void;
  reorderFlowSteps: (botId: string, activeId: string, overId: string) => void;
  toggleIntegration: (botId: string, integrationId: string, enabled: boolean) => void;
  flowCatalog: FlowModuleDefinition[];
  triggerCatalog: TriggerModuleDefinition[];
  integrationCatalog: IntegrationToggleDefinition[];
};

const BotsContext = createContext<BotsContextValue | undefined>(undefined);

const DEFAULT_STATS_ON_CREATE: BotStat[] = [
  { label: "Connected numbers", value: "0", delta: "Awaiting assignment" },
  { label: "Active bot versions", value: "1", delta: "Draft only" },
  { label: "Daily conversations", value: "0", delta: "No traffic yet" },
  { label: "Pending reviews", value: "0", delta: "Setup required" },
];

function truncate(text: string, max = 80) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatFlowSummary(moduleId: string, config: Record<string, unknown>): string {
  switch (moduleId) {
    case "collect_text":
      return `Prompt: ${truncate(String(config.prompt ?? "")) || "Configure prompt"}`;
    case "collect_number": {
      const prompt = truncate(String(config.prompt ?? ""));
      const min = config.min ?? null;
      const max = config.max ?? null;
      const range =
        min !== null && max !== null
          ? `Range ${min}-${max}`
          : min !== null
            ? `Min ${min}`
            : max !== null
              ? `Max ${max}`
              : "Any number";
      return `${prompt ? `${prompt} · ` : ""}${range}`;
    }
    case "collect_choice": {
      const choices = Array.isArray(config.choices) ? config.choices : [];
      const allowOther = Boolean(config.allowOther);
      return `${choices.length} choices${allowOther ? " · other allowed" : ""}`;
    }
    case "collect_yes_no": {
      const yesLabel = config.yesLabel ?? "Yes";
      const noLabel = config.noLabel ?? "No";
      return `Yes: ${yesLabel} / No: ${noLabel}`;
    }
    case "send_message": {
      const type = (config.type as string) ?? "text";
      const body = truncate(String(config.body ?? ""));
      return `${type.toUpperCase()} · ${body || "Empty message"}`;
    }
    case "delay": {
      const seconds = Number(config.durationSeconds ?? 0);
      return `Wait ${seconds}s${config.typingIndicator ? " · typing indicator" : ""}`;
    }
    case "branch_on_answer": {
      const sourceKey = config.sourceKey ?? "answer";
      return `Branch on ${sourceKey}`;
    }
    case "save_submission": {
      const destination = config.destination ?? "supabase.submissions";
      return `Destination: ${destination}`;
    }
    case "webhook_call": {
      const method = (config.method as string) ?? "POST";
      const url = truncate(String(config.url ?? ""));
      return `${method} ${url}`;
    }
    default:
      return "Configured";
  }
}

function formatTriggerDetail(moduleId: string, config: Record<string, unknown>): string {
  switch (moduleId) {
    case "start_command":
      return `Users send ${config.command || "/start"} to begin.`;
    case "keyword_match": {
      const keywords = Array.isArray(config.keywords) ? config.keywords : [];
      return keywords.length
        ? `Keywords: ${keywords.join(", ")}`
        : "Add keywords to activate.";
    }
    case "greeting_hala":
      return "Triggered by “هلا” greeting variations.";
    case "webhook_invoke":
      return "Triggered by external webhook call.";
    default:
      return "Configured";
  }
}

function createRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInstanceId(base: string) {
  return `${base}-${createRandomId()}`;
}

function findFlowDefinition(moduleId: string) {
  return flowModuleCatalog.find((module) => module.id === moduleId);
}

function findTriggerDefinition(moduleId: string) {
  return triggerModuleCatalog.find((module) => module.id === moduleId);
}

function findIntegrationDefinition(moduleId: string) {
  return integrationToggleCatalog.find((module) => module.id === moduleId);
}

function createFlowStepFromDefinition(
  moduleId: string,
  overrides: Partial<BotFlowStep> = {},
): BotFlowStep {
  const definition = findFlowDefinition(moduleId);
  const mergedConfig = {
    ...(definition?.defaultConfig ?? {}),
    ...(overrides.config ?? {}),
  };
  return {
    id: overrides.id ?? createInstanceId(moduleId),
    moduleId,
    name: overrides.name ?? definition?.name ?? moduleId,
    summary:
      overrides.summary ??
      formatFlowSummary(moduleId, mergedConfig) ??
      definition?.defaultSummary ??
      definition?.description ??
      "Module configured.",
    status: overrides.status ?? definition?.defaultStatus ?? "Draft",
    config: mergedConfig,
  };
}

function createTriggerFromDefinition(
  moduleId: string,
  overrides: Partial<BotTrigger> = {},
): BotTrigger {
  const definition = findTriggerDefinition(moduleId);
  const mergedConfig = {
    ...(definition?.defaultConfig ?? {}),
    ...(overrides.config ?? {}),
  };
  return {
    id: overrides.id ?? createInstanceId(moduleId),
    moduleId,
    name: overrides.name ?? definition?.name ?? moduleId,
    detail:
      overrides.detail ??
      formatTriggerDetail(moduleId, mergedConfig) ??
      definition?.defaultDetail ??
      definition?.description ??
      "",
    config: mergedConfig,
  };
}

function createIntegrationState(
  moduleId: string,
  overrides: Partial<BotIntegration> = {},
): BotIntegration {
  const definition = findIntegrationDefinition(moduleId);
  return {
    id: moduleId,
    label: overrides.label ?? definition?.label ?? moduleId,
    description: overrides.description ?? definition?.description ?? "",
    enabled:
      overrides.enabled ?? definition?.defaultEnabled ?? false,
    config: overrides.config ?? {},
  };
}

function buildPublishRequest(bot: Bot): PublishBotRequest {
  return {
    name: bot.name,
    description: bot.description,
    locale: bot.locale,
    requestedVersion: bot.version + 1,
    changeSummary: bot.changeSummary,
    assignedNumbers: bot.assignedNumbers,
    autoAssign: bot.autoAssign,
    flowDefinition: {
      triggers: bot.triggers,
      steps: bot.flowSteps,
      integrations: bot.integrations,
      metadata: {
        locale: bot.locale,
        autoAssign: bot.autoAssign,
      },
    },
  };
}

const DEFAULT_ACTIVITY: BotActivity[] = [
  {
    title: "Lead Capture v5 published",
    time: "18 minutes ago",
    detail: "Assigned to KSA Sales number",
  },
  {
    title: "WhatsApp reconnect required",
    time: "1 hour ago",
    detail: "Support Line – QR regenerated",
  },
  {
    title: "Webhook latency alert cleared",
    time: "Yesterday",
    detail: "CRM push back to normal levels",
  },
];

type DbBotVersionRow = {
  id: string;
  version_number: number;
  status: string;
  flow_definition: FlowDefinition | null;
  change_summary: string | null;
  published_at: string | null;
  created_at: string;
};

type DbBotRow = {
  id: string;
  name: string;
  description: string | null;
  default_locale: string;
  updated_at: string;
  bot_versions: DbBotVersionRow[] | null;
};

function mapDbBotToBot(row: DbBotRow): Bot {
  const versions = [...(row.bot_versions ?? [])];
  versions.sort((a, b) => b.version_number - a.version_number);
  const latest = versions[0];
  const flowDefinition: FlowDefinition = latest?.flow_definition ?? {
    triggers: [],
    steps: [],
    integrations: [],
  };
  const changeSummary = latest?.change_summary
    ? latest.change_summary.split("\n").filter(Boolean)
    : [];
  const statusMap: Record<string, Bot["status"]> = {
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  };
  const status = latest
    ? statusMap[latest.status as keyof typeof statusMap] ?? "Draft"
    : "Draft";

  return {
    id: row.id,
    name: row.name,
    status,
    updatedLabel: formatUpdatedLabel(row.updated_at),
    assignedNumbers: [],
    version: latest?.version_number ?? 1,
    locale: row.default_locale ?? "en-US",
    description: row.description ?? "",
    lastSync: new Date(row.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    stats: [
      { label: "Connected numbers", value: "0", delta: "Sync needed" },
      { label: "Active bot versions", value: String(versions.length || 1), delta: status },
      { label: "Daily conversations", value: "0", delta: "Pending runtime" },
      { label: "Pending reviews", value: "0", delta: "None" },
    ],
    triggers: Array.isArray(flowDefinition.triggers)
      ? (flowDefinition.triggers as BotTrigger[])
      : [],
    flowSteps: Array.isArray(flowDefinition.steps)
      ? (flowDefinition.steps as BotFlowStep[])
      : [],
    integrations: Array.isArray(flowDefinition.integrations)
      ? (flowDefinition.integrations as BotIntegration[])
      : integrationToggleCatalog.map((integration) =>
          createIntegrationState(integration.id, { enabled: integration.defaultEnabled }),
        ),
    changeSummary,
    activity:
      latest?.published_at
        ? [
            {
              title: `Version ${latest.version_number} ${status.toLowerCase()}`,
              time: new Date(latest.published_at).toLocaleString(),
              detail: changeSummary[changeSummary.length - 1] ?? "",
            },
          ]
        : DEFAULT_ACTIVITY,
    autoAssign: Boolean(flowDefinition.metadata?.autoAssign),
  };
}

function formatUpdatedLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}



export function BotsProvider({ children }: { children: ReactNode }) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [publishingBotIds, setPublishingBotIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user, supabase } = useAuth();

  const refreshBots = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("bots")
      .select(
        `
        id,
        name,
        description,
        default_locale,
        updated_at,
        bot_versions:bot_versions_bot_id_fkey (
          id,
          version_number,
          status,
          flow_definition,
          change_summary,
          published_at,
          created_at
        )
      `,
      )
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        title: "Failed to load bots",
        description: error.message,
        intent: "error",
      });
      return;
    }

    setBots((data ?? []).map(mapDbBotToBot));
  }, [supabase, toast]);

  useEffect(() => {
    if (!user) {
      setBots([]);
      return;
    }
    refreshBots();
  }, [refreshBots, user]);

  const createBot = useCallback(
    ({ name, locale, description, autoAssign }: CreateBotInput): Bot => {
      const trimmedName = name.trim();
      const baseSlug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `bot-${createRandomId()}`;
      const exists = bots.find((bot) => bot.id === baseSlug);
      const id = exists ? `${baseSlug}-${createRandomId().slice(-4)}` : baseSlug;
      const lastSync = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newBot: Bot = {
        id,
        name: trimmedName,
        status: "Draft",
        updatedLabel: "Just now",
        assignedNumbers: [],
        version: 1,
        locale,
        description,
        lastSync,
        stats: DEFAULT_STATS_ON_CREATE,
        triggers: [],
        flowSteps: [],
        integrations: integrationToggleCatalog.map((integration) =>
          createIntegrationState(integration.id, {
            enabled: integration.defaultEnabled && autoAssign,
          }),
        ),
        changeSummary: ["Initial draft created."],
        activity: [
          {
            title: "Draft created",
            time: "Just now",
            detail: "Fill triggers and publish when ready.",
          },
        ],
        autoAssign,
      };

      setBots((prev) => [newBot, ...prev]);
      return newBot;
    },
    [bots],
  );

  const updateBot = useCallback(
    (id: string, updater: (bot: Bot) => Bot) => {
      setBots((prev) =>
        prev.map((bot) => (bot.id === id ? updater(bot) : bot)),
      );
    },
    [],
  );

  const updateBotMetadata = useCallback(
    (id: string, metadata: Pick<Bot, "name" | "description" | "locale">) => {
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === id
            ? {
                ...bot,
                name: metadata.name,
                description: metadata.description,
                locale: metadata.locale,
                changeSummary: [
                  ...bot.changeSummary,
                  "Updated bot metadata (name, description, or locale).",
                ],
              }
            : bot,
        ),
      );
    },
    [],
  );

  const saveDraft = useCallback((id: string) => {
    setBots((prev) =>
      prev.map((bot) =>
        bot.id === id
          ? {
              ...bot,
              status: bot.status === "Archived" ? bot.status : "Draft",
              updatedLabel: "Just now",
              changeSummary: [...bot.changeSummary, "Draft saved."],
            }
          : bot,
      ),
    );
  }, []);

  const publishBot = useCallback(
    async (id: string) => {
      const bot = bots.find((item) => item.id === id);
      if (!bot) {
        toast({
          title: "Bot not found",
          description: "Refresh the list and try again.",
          intent: "error",
        });
        return;
      }

      const payload: PublishBotRequest = {
        ...buildPublishRequest(bot),
        actorId: user?.id,
        actorEmail: user?.email ?? undefined,
        actorName:
          (user?.user_metadata as { full_name?: string } | null)?.full_name ??
          user?.email ??
          undefined,
      };

      setPublishingBotIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      try {
        const response = await fetch(`/api/bots/${encodeURIComponent(id)}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const rawBody = await response.text();
        let parsedBody: unknown = null;
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          parsedBody = null;
        }

        if (!response.ok) {
          const errorMessage =
            (parsedBody as { error?: string } | null)?.error ??
            (rawBody || `Failed to publish bot (status ${response.status})`);
          throw new Error(errorMessage);
        }

        const data = publishBotResponseSchema.parse(parsedBody);

        await refreshBots();

        toast({
          title: "Bot published",
          description: `${bot.name} v${data.version} is live now.`,
          intent: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to publish bot";
        console.error("Failed to publish bot", error);
        toast({
          title: "Publish failed",
          description: message,
          intent: "error",
        });
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setPublishingBotIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [bots, toast, user, refreshBots],
  );

  const isPublishing = useCallback(
    (id: string) => publishingBotIds.has(id),
    [publishingBotIds],
  );

  const setBotNumberAssignment = useCallback(
    (botId: string, numberId: string, assign: boolean) => {
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId
            ? {
                ...bot,
                assignedNumbers: assign
                  ? Array.from(new Set([...bot.assignedNumbers, numberId]))
                  : bot.assignedNumbers.filter((id) => id !== numberId),
                changeSummary: [
                  ...bot.changeSummary,
                  assign
                    ? `Assigned number ${numberId}.`
                    : `Unassigned number ${numberId}.`,
                ],
              }
            : bot,
        ),
      );
    },
    [],
  );

  const addTrigger = useCallback((botId: string, moduleId: string) => {
    const definition = findTriggerDefinition(moduleId);
    if (!definition) return;
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const alreadyExists = bot.triggers.some(
          (trigger) => trigger.moduleId === moduleId,
        );
        if (alreadyExists) return bot;
        const trigger = createTriggerFromDefinition(moduleId);
        return {
          ...bot,
          triggers: [...bot.triggers, trigger],
          changeSummary: [
            ...bot.changeSummary,
            `Added trigger ${definition.name}.`,
          ],
        };
      }),
    );
  }, []);

  const removeTrigger = useCallback((botId: string, triggerId: string) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const trigger = bot.triggers.find((item) => item.id === triggerId);
        if (!trigger) return bot;
        return {
          ...bot,
          triggers: bot.triggers.filter((item) => item.id !== triggerId),
          changeSummary: [
            ...bot.changeSummary,
            `Removed trigger ${trigger.name}.`,
          ],
        };
      }),
    );
  }, []);

  const updateTriggerConfig = useCallback(
    (botId: string, triggerId: string, config: Record<string, unknown>) => {
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          let updated = false;
          let updatedTriggerName = "";
          const triggers = bot.triggers.map((trigger) => {
            if (trigger.id !== triggerId) return trigger;
            updated = true;
             updatedTriggerName = trigger.name;
            const mergedConfig = { ...trigger.config, ...config };
            return {
              ...trigger,
              config: mergedConfig,
              detail: formatTriggerDetail(trigger.moduleId, mergedConfig),
            };
          });
          return updated
            ? {
                ...bot,
                triggers,
                changeSummary: [
                  ...bot.changeSummary,
                  `Updated trigger ${updatedTriggerName || triggerId}.`,
                ],
              }
            : bot;
        }),
      );
    },
    [],
  );

  const addFlowStep = useCallback((botId: string, moduleId: string) => {
    const definition = findFlowDefinition(moduleId);
    if (!definition) return;
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const flowStep = createFlowStepFromDefinition(moduleId);
        return {
          ...bot,
          flowSteps: [...bot.flowSteps, flowStep],
          changeSummary: [
            ...bot.changeSummary,
            `Added module ${definition.name}.`,
          ],
        };
      }),
    );
  }, []);

  const removeFlowStep = useCallback((botId: string, flowStepId: string) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const step = bot.flowSteps.find((item) => item.id === flowStepId);
        if (!step) return bot;
        const remaining = bot.flowSteps
          .filter((item) => item.id !== flowStepId)
          .map((item) =>
            item.nextStepId === flowStepId ? { ...item, nextStepId: null } : item,
          );
        return {
          ...bot,
          flowSteps: remaining,
          changeSummary: [
            ...bot.changeSummary,
            `Removed module ${step.name}.`,
          ],
        };
      }),
    );
  }, []);

  const updateFlowStepConfig = useCallback(
    (botId: string, flowStepId: string, config: Record<string, unknown>) => {
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          let updated = false;
          let updatedModuleName = "";
          const flowSteps = bot.flowSteps.map((step) => {
            if (step.id !== flowStepId) return step;
            updated = true;
            updatedModuleName = step.name;
            const mergedConfig = { ...step.config, ...config };
            return {
              ...step,
              config: mergedConfig,
              summary: formatFlowSummary(step.moduleId, mergedConfig),
              status: "Configured",
            };
          });
          return updated
            ? {
                ...bot,
                flowSteps,
                changeSummary: [
                  ...bot.changeSummary,
                  `Updated module ${updatedModuleName || flowStepId}.`,
                ],
              }
            : bot;
        }),
      );
    },
    [],
  );

  const toggleIntegration = useCallback(
    (botId: string, integrationId: string, enabled: boolean) => {
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          const integrations = bot.integrations.map((integration) =>
            integration.id === integrationId
              ? { ...integration, enabled }
              : integration,
          );
          return { ...bot, integrations };
        }),
      );
    },
    [],
  );

  const reorderFlowSteps = useCallback(
    (botId: string, activeId: string, overId: string) => {
      if (activeId === overId) return;
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          const currentIndex = bot.flowSteps.findIndex((step) => step.id === activeId);
          const overIndex = bot.flowSteps.findIndex((step) => step.id === overId);
          if (currentIndex === -1 || overIndex === -1) return bot;
          const reordered = [...bot.flowSteps];
          const [moved] = reordered.splice(currentIndex, 1);
          reordered.splice(overIndex, 0, moved);
          return {
            ...bot,
            flowSteps: reordered,
            changeSummary: [...bot.changeSummary, "Reordered modules."],
          };
        }),
      );
    },
    [],
  );

  const value = useMemo<BotsContextValue>(
    () => ({
      bots,
      createBot,
      updateBot,
      getBot: (id: string) => bots.find((bot) => bot.id === id),
      updateBotMetadata,
      saveDraft,
      publishBot,
      isPublishing,
      setBotNumberAssignment,
      addTrigger,
      removeTrigger,
      updateTriggerConfig,
      addFlowStep,
      removeFlowStep,
      updateFlowStepConfig,
      toggleIntegration,
      reorderFlowSteps,
      flowCatalog: flowModuleCatalog,
      triggerCatalog: triggerModuleCatalog,
      integrationCatalog: integrationToggleCatalog,
    }),
    [
      bots,
      createBot,
      updateBot,
      updateBotMetadata,
      saveDraft,
      publishBot,
      isPublishing,
      setBotNumberAssignment,
      addTrigger,
      removeTrigger,
      updateTriggerConfig,
      addFlowStep,
      removeFlowStep,
      updateFlowStepConfig,
      toggleIntegration,
      reorderFlowSteps,
    ],
  );

  return <BotsContext.Provider value={value}>{children}</BotsContext.Provider>;
}

export function useBots() {
  const context = useContext(BotsContext);
  if (!context) {
    throw new Error("useBots must be used within a BotsProvider");
  }
  return context;
}
