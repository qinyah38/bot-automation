"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TriggerModuleDefinition } from "@/data/module-catalog";
import { Bot } from "@/state/bots-context";

type TriggerSectionProps = {
  bot: Bot;
  triggerCatalog: TriggerModuleDefinition[];
  onConfigure: (triggerId: string) => void;
  addTrigger: (botId: string, moduleId: string) => void;
  removeTrigger: (botId: string, triggerId: string) => void;
};

export function TriggersSection({
  bot,
  triggerCatalog,
  onConfigure,
  addTrigger,
  removeTrigger,
}: TriggerSectionProps) {
  const triggers = bot.triggers ?? [];

  const triggerDefinitionMap = useMemo(() => {
    const map = new Map<string, TriggerModuleDefinition>();
    triggerCatalog.forEach((definition) => map.set(definition.id, definition));
    return map;
  }, [triggerCatalog]);

  const availableTriggerOptions = useMemo(() => {
    const existingIds = (bot.triggers ?? []).map((trigger) => trigger.moduleId);
    return triggerCatalog.filter((definition) => !existingIds.includes(definition.id));
  }, [triggerCatalog, bot.triggers]);

  const [selectedTriggerId, setSelectedTriggerId] = useState<string>(
    availableTriggerOptions[0]?.id ?? "",
  );

  return (
    <Card className="border border-border shadow-[var(--shadow-1)]">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Entry triggers</CardTitle>
          <CardDescription>
            Pick how conversations should start. Trigger modules are reusable across bots.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTriggerId}
            onChange={(event) => setSelectedTriggerId(event.target.value)}
            disabled={availableTriggerOptions.length === 0}
            className="h-10 min-w-[200px] rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-1)] transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
          >
            {availableTriggerOptions.length === 0 ? (
              <option value="">No more triggers available</option>
            ) : (
              availableTriggerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))
            )}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedTriggerId) addTrigger(bot.id, selectedTriggerId);
            }}
            disabled={!selectedTriggerId}
          >
            Add trigger
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {triggers.length > 0 ? (
          triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{trigger.name}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                  module: {trigger.moduleId}
                </p>
                <p className="text-sm text-foreground/70">{trigger.detail}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    (triggerDefinitionMap.get(trigger.moduleId)?.fields.length ?? 0) === 0
                  }
                  onClick={() => onConfigure(trigger.id)}
                >
                  Configure
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTrigger(bot.id, trigger.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-foreground/70">
            No triggers defined yet. Add a start command or keyword to kick off the conversation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
