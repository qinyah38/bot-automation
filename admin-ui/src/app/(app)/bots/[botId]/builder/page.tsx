"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleConfigDialog } from "@/components/builder/module-config-dialog";
import { SimulationDialog } from "@/components/builder/simulation-dialog";
import { BotNumberAssignmentsDialog } from "@/components/builder/bot-number-assignments-dialog";
import { TriggersSection } from "@/components/builder/triggers-section";
import { FlowBuilderSection } from "@/components/builder/flow-builder-section";
import { useBots } from "@/state/bots-context";
import { useNumbers } from "@/state/numbers-context";

type BuilderPageProps = {
  params: Promise<{ botId: string }>;
};

export default function BotBuilderPage({ params }: BuilderPageProps) {
  const { botId } = use(params);
  const {
    getBot,
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
    reorderFlowSteps,
    toggleIntegration,
    flowCatalog,
    triggerCatalog,
  } = useBots();
  const { numbers, assignNumberToBot } = useNumbers();
  const bot = getBot(botId);
  const flowDefinitionMap = useMemo(() => {
    return new Map(flowCatalog.map((definition) => [definition.id, definition]));
  }, [flowCatalog]);

  const triggerDefinitionMap = useMemo(() => {
    return new Map(triggerCatalog.map((definition) => [definition.id, definition]));
  }, [triggerCatalog]);

  const [activeFlowStepId, setActiveFlowStepId] = useState<string | null>(null);
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [assignNumbersOpen, setAssignNumbersOpen] = useState(false);

  const stats = bot?.stats ?? [];
  const triggers = bot?.triggers ?? [];
  const flowSteps = bot?.flowSteps ?? [];
  const integrations = bot?.integrations ?? [];
  const activity = bot?.activity ?? [];
  const changeSummary = bot?.changeSummary ?? [];
  const assignedNumbers = bot?.assignedNumbers ?? [];

  const numbersById = useMemo(() => {
    const map = new Map<string, { displayName: string; status: string }>();
    numbers.forEach((number) =>
      map.set(number.id, { displayName: number.displayName, status: number.status }),
    );
    return map;
  }, [numbers]);

  const handleNumberAssignmentToggle = (numberId: string, assign: boolean) => {
    assignNumberToBot(numberId, bot.id, assign);
    setBotNumberAssignment(bot.id, numberId, assign);
  };

  const activeFlowStep = activeFlowStepId
    ? flowSteps.find((step) => step.id === activeFlowStepId) ?? null
    : null;
  const activeFlowDefinition = activeFlowStep
    ? flowDefinitionMap.get(activeFlowStep.moduleId)
    : undefined;

  const activeTrigger = activeTriggerId
    ? triggers.find((trigger) => trigger.id === activeTriggerId) ?? null
    : null;
  const activeTriggerDefinition = activeTrigger
    ? triggerDefinitionMap.get(activeTrigger.moduleId)
    : undefined;

  useEffect(() => {
    if (activeFlowStepId && !activeFlowStep) {
      setActiveFlowStepId(null);
    }
  }, [activeFlowStepId, activeFlowStep]);

  useEffect(() => {
    if (activeTriggerId && !activeTrigger) {
      setActiveTriggerId(null);
    }
  }, [activeTriggerId, activeTrigger]);

  if (!bot) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <Link
            href="/bots"
            className="text-xs uppercase tracking-[0.28em] text-foreground/50 transition hover:text-foreground"
          >
            ← Bots
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">
            Bot not found
          </h1>
          <p className="text-sm text-foreground/70">
            The builder could not locate this bot. Please return to the bots
            list and pick an existing configuration.
          </p>
        </header>
        <Button asChild size="sm">
          <Link href="/bots">Back to bots</Link>
        </Button>
      </div>
    );
  }

  const handlePublish = async () => {
    try {
      await publishBot(bot.id);
    } catch {
      // toast already handled in context
    }
  };

  const publishing = isPublishing(bot.id);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/bots"
            className="text-xs uppercase tracking-[0.28em] text-foreground/50 transition hover:text-foreground"
          >
            ← Bots
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              {bot.name} builder
            </h1>
            <p className="text-sm text-foreground/70">
              Version {bot.version}. Configure flow modules, triggers, and
              integrations before publishing.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => saveDraft(bot.id)}>
            Save draft
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSimulateOpen(true)}>
            Simulate conversation
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
              </span>
            ) : (
              "Publish changes"
            )}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start gap-2 bg-background">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="flow">Conversation flow</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="review">Review & Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border border-border shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>Bot metadata</CardTitle>
              <CardDescription>
                Edit core details that appear across the admin and runtime
                layers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bot-name">Bot name</Label>
                <Input
                  id="bot-name"
                  defaultValue={bot.name}
                  placeholder="e.g., Lead Capture"
                  onBlur={(event) =>
                    updateBotMetadata(bot.id, {
                      name: event.target.value,
                      description: bot.description,
                      locale: bot.locale,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bot-locale">Default locale</Label>
                <select
                  id="bot-locale"
                  defaultValue={bot.locale}
                  onChange={(event) =>
                    updateBotMetadata(bot.id, {
                      name: bot.name,
                      description: bot.description,
                      locale: event.target.value,
                    })
                  }
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-1)] transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="ar-SA">Arabic (Saudi Arabia)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="bot-description">Description</Label>
                <Textarea
                  id="bot-description"
                  defaultValue={bot.description}
                  placeholder="Describe the bot’s purpose so teammates understand it quickly."
                  rows={4}
                  onBlur={(event) =>
                    updateBotMetadata(bot.id, {
                      name: bot.name,
                      description: event.target.value,
                      locale: bot.locale,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-dashed border-border shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>Assigned numbers</CardTitle>
              <CardDescription>
                Numbers that will receive this configuration when published.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm text-foreground/70">
              {assignedNumbers.length > 0 ? (
                <>
                  {assignedNumbers.map((numberId) => {
                    const details = numbersById.get(numberId);
                    const label = details ? `${details.displayName} (${details.status})` : numberId;
                    return (
                      <span
                        key={numberId}
                        className="rounded-full border border-dashed border-border px-3 py-1"
                      >
                        WhatsApp · {label}
                      </span>
                    );
                  })}
                  <Button variant="ghost" size="sm" onClick={() => setAssignNumbersOpen(true)}>
                    Manage assignments
                  </Button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span>No numbers assigned yet.</span>
                  <Button variant="ghost" size="sm" onClick={() => setAssignNumbersOpen(true)}>
                    Manage assignments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>Snapshot</CardTitle>
              <CardDescription>
                Last sync {bot.lastSync || "--:--"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {stats.length > 0 ? (
                stats.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-dashed border-border/80 bg-background px-4 py-3"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">
                        {item.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">
                        {item.value}
                      </p>
                    </div>
                    <span className="text-sm text-primary">{item.delta}</span>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-sm text-foreground/60">
                  No metrics yet. Configure modules and publish to populate
                  runtime stats.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triggers" className="space-y-4">
          <TriggersSection
            bot={bot}
            triggerCatalog={triggerCatalog}
            onConfigure={setActiveTriggerId}
            addTrigger={addTrigger}
            removeTrigger={removeTrigger}
          />
        </TabsContent>

        <TabsContent value="flow" className="space-y-4">
          <FlowBuilderSection
            bot={bot}
            flowCatalog={flowCatalog}
            onConfigureStep={setActiveFlowStepId}
            addFlowStep={addFlowStep}
            removeFlowStep={removeFlowStep}
            reorderFlowSteps={reorderFlowSteps}
          />

          <Card className="border border-dashed border-border shadow-[var(--shadow-1)]">
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>
                  Latest activity across bots and numbers
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                See all activity
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity.length > 0 ? (
                activity.map((item) => (
                  <div
                    key={`${item.title}-${item.time}`}
                    className="grid gap-1 border-l-2 border-dashed border-border pl-4"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/50">
                      {item.time}
                    </p>
                    <p className="text-sm text-foreground/70">{item.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground/60">
                  Activity will appear here once changes are made to this bot or
                  its assignments.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card className="border border-border shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Control how runtime outputs flow into external systems.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {integrations.length > 0 ? (
                integrations.map((item) => (
                  <label
                    key={item.id}
                    className="flex w-full items-start justify-between gap-4 rounded-xl border border-dashed border-border bg-background px-4 py-3 transition hover:border-border/80"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm text-foreground/70">
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(value) =>
                        toggleIntegration(bot.id, item.id, value)
                      }
                      aria-label={item.label}
                    />
                  </label>
                ))
              ) : (
                <p className="text-sm text-foreground/60">
                  No integrations configured yet. Enable analytics mirroring,
                  CRM notifications, or alerts when ready.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card className="border border-border shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>Publish checklist</CardTitle>
              <CardDescription>
                Validate draft changes before promoting to a live version.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                  Status
                </p>
                <p className="text-sm font-medium text-foreground">
                  Draft v{bot.version + 1} ready for review
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                  Tests
                </p>
                <p className="text-sm text-foreground/70">
                  Synthetic conversation pending. Run simulation before publish.
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                  Change summary
                </p>
                {changeSummary.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/70">
                {changeSummary.map((entry, index) => (
                  <li key={`${index}-${entry.slice(0, 24)}`}>{entry}</li>
                ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-foreground/60">
                    No notes yet. Add highlights so teammates know what changed.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <Button variant="ghost" size="sm">
                  Start QA simulation
                </Button>
                <Button size="sm">Publish version {bot.version + 1}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {activeFlowStep && activeFlowDefinition && (
        <ModuleConfigDialog
          open={Boolean(activeFlowStepId)}
          onOpenChange={(open) => {
            if (!open) setActiveFlowStepId(null);
          }}
          title={`Configure ${activeFlowDefinition.name}`}
          description={activeFlowDefinition.description}
          definition={activeFlowDefinition}
          initialConfig={activeFlowStep.config}
          onSubmit={(config) =>
            updateFlowStepConfig(bot.id, activeFlowStep.id, config)
          }
        />
      )}

      {activeTrigger && activeTriggerDefinition && (
        <ModuleConfigDialog
          open={Boolean(activeTriggerId)}
          onOpenChange={(open) => {
            if (!open) setActiveTriggerId(null);
          }}
          title={`Configure ${activeTriggerDefinition.name}`}
          description={activeTriggerDefinition.description}
          definition={activeTriggerDefinition}
          initialConfig={activeTrigger.config}
          onSubmit={(config) =>
            updateTriggerConfig(bot.id, activeTrigger.id, config)
          }
        />
      )}

      <SimulationDialog
        open={simulateOpen}
        onOpenChange={setSimulateOpen}
        title={`Simulate ${bot.name}`}
        description="Preview the configured modules in order. Runtime simulation will use the engine once connected."
        preview={
          <div className="space-y-4">
            {flowSteps.length === 0 ? (
              <p className="text-sm text-foreground/60">
                No modules configured yet. Add steps to preview the conversation flow.
              </p>
            ) : (
              flowSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-xl border border-dashed border-border bg-background px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                    Step {index + 1} · {step.moduleId}
                  </p>
                  <p className="text-sm font-medium text-foreground">{step.name}</p>
                  <p className="text-sm text-foreground/70">{step.summary}</p>
                </div>
              ))
            )}
          </div>
        }
      />

      <BotNumberAssignmentsDialog
        open={assignNumbersOpen}
        onOpenChange={setAssignNumbersOpen}
        bot={bot}
        numbers={numbers}
        onToggle={(numberId, checked) => handleNumberAssignmentToggle(numberId, checked)}
      />
    </div>
  );
}
