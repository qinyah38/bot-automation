"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TriggersSection } from "@/components/builder/triggers-section";
import { FlowBuilderSection } from "@/components/builder/flow-builder-section";
import { ModuleConfigDialog } from "@/components/builder/module-config-dialog";
import { RegisterNumberDialog } from "@/components/numbers/register-number-dialog";
import { NumberOnboardingDialog } from "@/components/numbers/number-onboarding-dialog";
import { useBots } from "@/state/bots-context";
import { useNumbers } from "@/state/numbers-context";

const steps = ["details", "triggers", "flow", "numbers", "review"] as const;
type WizardStep = (typeof steps)[number];

export default function BotWizardPage() {
  const router = useRouter();
  const {
    bots,
    createBot,
    updateBotMetadata,
    addTrigger,
    removeTrigger,
    updateTriggerConfig,
    addFlowStep,
    removeFlowStep,
    updateFlowStepConfig,
    reorderFlowSteps,
    publishBot,
    isPublishing,
    setBotNumberAssignment,
    flowCatalog,
    triggerCatalog,
  } = useBots();
  const {
    numbers,
    createNumber,
    assignNumberToBot,
    regenerateQr,
    markQrScanned,
  } = useNumbers();

  const [stepIndex, setStepIndex] = useState(0);
  const [botId, setBotId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("ar-SA");
  const [description, setDescription] = useState("");
  const [autoAssignPreferred, setAutoAssignPreferred] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);
  const [activeFlowStepId, setActiveFlowStepId] = useState<string | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [onboardingNumberId, setOnboardingNumberId] = useState<string | null>(null);

  const currentStep: WizardStep = steps[stepIndex];
  const bot = botId ? bots.find((item) => item.id === botId) ?? null : null;
  const publishBusy = bot ? isPublishing(bot.id) : false;

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setLocale(bot.locale);
      setDescription(bot.description);
    }
  }, [bot]);

  const numbersById = useMemo(() => {
    const map = new Map<string, { displayName: string; status: string }>();
    numbers.forEach((number) =>
      map.set(number.id, { displayName: number.displayName, status: number.status }),
    );
    return map;
  }, [numbers]);

  const onboardingNumber = onboardingNumberId
    ? numbers.find((n) => n.id === onboardingNumberId) ?? null
    : null;

  const activeTrigger = activeTriggerId && bot
    ? bot.triggers.find((trigger) => trigger.id === activeTriggerId) ?? null
    : null;
  const activeTriggerDefinition = activeTrigger
    ? triggerCatalog.find((definition) => definition.id === activeTrigger.moduleId)
    : undefined;

  const activeFlowStep = activeFlowStepId && bot
    ? bot.flowSteps.find((step) => step.id === activeFlowStepId) ?? null
    : null;
  const activeFlowDefinition = activeFlowStep
    ? flowCatalog.find((definition) => definition.id === activeFlowStep.moduleId)
    : undefined;

  const handleMetadataNext = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Bot name is required");
      return;
    }
    if (!botId) {
      const created = createBot({
        name: trimmedName,
        locale,
        description: description.trim(),
        autoAssign: autoAssignPreferred,
      });
      setBotId(created.id);
    } else if (bot) {
      updateBotMetadata(bot.id, {
        name: trimmedName,
        description: description.trim(),
        locale,
      });
    }
    setFormError(null);
    setStepIndex(1);
  };

  const handlePublish = async () => {
    if (!bot) return;
    try {
      await publishBot(bot.id);
      router.push(`/bots/${bot.id}/builder`);
    } catch {
      // toast already surfaced from context, keep user on step
    }
  };

  const handleNumberToggle = (numberId: string, checked: boolean) => {
    if (!bot) return;
    assignNumberToBot(numberId, bot.id, checked);
    setBotNumberAssignment(bot.id, numberId, checked);
  };

  const renderStepControls = (nextDisabled = false) => (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">
        Step {stepIndex + 1} of {steps.length}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
          disabled={stepIndex === 0}
        >
          Back
        </Button>
        {currentStep !== "review" ? (
          <Button
            size="sm"
            onClick={() => setStepIndex((index) => Math.min(index + 1, steps.length - 1))}
            disabled={nextDisabled}
          >
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={handlePublish} disabled={!bot || publishBusy}>
            {bot && publishBusy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
              </span>
            ) : (
              "Publish bot"
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/bots"
          className="text-xs uppercase tracking-[0.28em] text-foreground/50 transition hover:text-foreground"
        >
          ← Bots
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Build a WhatsApp bot</h1>
        <p className="text-sm text-foreground/70">
          Follow the guided steps to configure triggers, flows, and assign a number. You can return
          later to edit or publish.
        </p>
      </header>

      {currentStep === "details" && (
        <Card className="border border-border shadow-[var(--shadow-1)]">
          <CardHeader>
            <CardTitle>1. Bot details</CardTitle>
            <CardDescription>Tell us what this bot is for. You can change these later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bot-name">Bot name</Label>
              <Input
                id="bot-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g., Lead Capture"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bot-locale">Default locale</Label>
              <select
                id="bot-locale"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
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
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this bot does and who it serves."
                rows={4}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-foreground">
                Auto-assign available numbers
              </Label>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-dashed border-border bg-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Suggest registered numbers after publish
                  </p>
                  <p className="text-sm text-foreground/70">
                    Keep enabled so the wizard reminds you to link a WhatsApp number once setup is complete.
                  </p>
                </div>
                <Switch
                  checked={autoAssignPreferred}
                  onCheckedChange={setAutoAssignPreferred}
                  aria-label="Auto assign numbers"
                />
              </div>
            </div>
            {formError && <p className="sm:col-span-2 text-sm text-destructive">{formError}</p>}
            <div className="sm:col-span-2 flex justify-end">
              <Button size="sm" onClick={handleMetadataNext}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {bot && currentStep === "triggers" && (
        <>
          <TriggersSection
            bot={bot}
            triggerCatalog={triggerCatalog}
            onConfigure={setActiveTriggerId}
            addTrigger={addTrigger}
            removeTrigger={removeTrigger}
          />
          {renderStepControls(bot.triggers.length === 0)}
        </>
      )}

      {bot && currentStep === "flow" && (
        <>
          <FlowBuilderSection
            bot={bot}
            flowCatalog={flowCatalog}
            onConfigureStep={setActiveFlowStepId}
            addFlowStep={addFlowStep}
            removeFlowStep={removeFlowStep}
            reorderFlowSteps={reorderFlowSteps}
          />
          {renderStepControls(bot.flowSteps.length === 0)}
        </>
      )}

      {bot && currentStep === "numbers" && (
        <Card className="border border-border shadow-[var(--shadow-1)]">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>4. Assign a WhatsApp number</CardTitle>
              <CardDescription>
                Choose an existing number or register a new one. You can manage numbers later from the Numbers screen.
              </CardDescription>
            </div>
            <div>
              <Button variant="ghost" size="sm" onClick={() => setRegisterDialogOpen(true)}>
                Register number
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {numbers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-foreground/70">
                No numbers available yet. Register one to proceed.
              </p>
            ) : (
              numbers.map((number) => {
                const assigned = bot.assignedNumbers.includes(number.id);
                return (
                  <label
                    key={number.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm hover:border-border/80"
                  >
                    <div>
                      <p className="font-medium text-foreground">{number.displayName}</p>
                      <p className="text-xs text-foreground/60">
                        {number.phoneNumber} · {number.status}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={assigned}
                      onChange={(event) => handleNumberToggle(number.id, event.target.checked)}
                    />
                  </label>
                );
              })
            )}
            {renderStepControls(bot.assignedNumbers.length === 0)}
          </CardContent>
        </Card>
      )}

      {bot && currentStep === "review" && (
        <Card className="border border-border shadow-[var(--shadow-1)]">
          <CardHeader>
            <CardTitle>5. Review & publish</CardTitle>
            <CardDescription>
              Double-check your configuration before going live. You can always edit the bot later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground/80">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Bot</h2>
              <p>Name: {bot.name}</p>
              <p>Locale: {bot.locale}</p>
              <p>Description: {bot.description || "—"}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Triggers</h2>
              {bot.triggers.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {bot.triggers.map((trigger) => (
                    <li key={trigger.id}>{trigger.name}</li>
                  ))}
                </ul>
              ) : (
                <p>No triggers configured yet.</p>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Conversation flow</h2>
              {bot.flowSteps.length ? (
                <ol className="list-decimal space-y-1 pl-5">
                  {bot.flowSteps.map((step) => (
                    <li key={step.id}>{step.name} – {step.summary}</li>
                  ))}
                </ol>
              ) : (
                <p>No modules configured yet.</p>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Numbers</h2>
              {bot.assignedNumbers.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {bot.assignedNumbers.map((numberId) => {
                    const details = numbersById.get(numberId);
                    return (
                      <li key={numberId}>
                        {details ? `${details.displayName} (${details.status})` : numberId}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No numbers assigned yet.</p>
              )}
            </div>
            {renderStepControls()}
          </CardContent>
        </Card>
      )}

      <ModuleConfigDialog
        open={Boolean(activeTriggerId && currentStep === "triggers")}
        onOpenChange={(open) => {
          if (!open) setActiveTriggerId(null);
        }}
        title={activeTriggerDefinition?.name ?? "Configure trigger"}
        description={activeTriggerDefinition?.description ?? ""}
        definition={activeTriggerDefinition ?? triggerCatalog[0]}
        initialConfig={activeTrigger?.config ?? {}}
        onSubmit={(config) => {
          if (bot && activeTrigger) {
            updateTriggerConfig(bot.id, activeTrigger.id, config);
          }
        }}
      />

      <ModuleConfigDialog
        open={Boolean(activeFlowStepId && currentStep === "flow")}
        onOpenChange={(open) => {
          if (!open) setActiveFlowStepId(null);
        }}
        title={activeFlowDefinition?.name ?? "Configure module"}
        description={activeFlowDefinition?.description ?? ""}
        definition={activeFlowDefinition ?? flowCatalog[0]}
        initialConfig={activeFlowStep?.config ?? {}}
        onSubmit={(config) => {
          if (bot && activeFlowStep) {
            updateFlowStepConfig(bot.id, activeFlowStep.id, config);
          }
        }}
      />

      <RegisterNumberDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onSubmit={(values) => {
          const newNumber = createNumber(values);
          setOnboardingNumberId(newNumber.id);
        }}
      />

      <NumberOnboardingDialog
        open={Boolean(onboardingNumber)}
        number={onboardingNumber}
        onOpenChange={(open) => {
          if (!open) setOnboardingNumberId(null);
        }}
        onMarkScanned={(numberId) => {
          markQrScanned(numberId);
          setOnboardingNumberId(null);
        }}
        onRegenerate={(numberId) => regenerateQr(numberId)}
      />


    </div>
  );
}
