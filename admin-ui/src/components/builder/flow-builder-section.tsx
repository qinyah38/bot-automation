"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowModuleDefinition } from "@/data/module-catalog";
import { Bot } from "@/state/bots-context";
import { cn } from "@/lib/utils";

type FlowBuilderSectionProps = {
  bot: Bot;
  flowCatalog: FlowModuleDefinition[];
  onConfigureStep: (stepId: string) => void;
  addFlowStep: (botId: string, moduleId: string) => void;
  removeFlowStep: (botId: string, flowStepId: string) => void;
  reorderFlowSteps: (botId: string, activeId: string, overId: string) => void;
};

type SortableFlowItemProps = {
  stepId: string;
  children: React.ReactNode;
};

function SortableFlowItem({ stepId, children }: SortableFlowItemProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stepId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-dashed border-border bg-background px-4 py-4",
        isDragging && "opacity-70 shadow-[var(--shadow-2)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-foreground/50">
        <button
          type="button"
          className="flex cursor-grab items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[0.6rem]"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden className="text-base leading-none">⋮⋮</span>
          Drag
        </button>
      </div>
      {children}
    </div>
  );
}

export function FlowBuilderSection({
  bot,
  flowCatalog,
  onConfigureStep,
  addFlowStep,
  removeFlowStep,
  reorderFlowSteps,
}: FlowBuilderSectionProps) {
  const flowDefinitionMap = useMemo(() => {
    const map = new Map<string, FlowModuleDefinition>();
    flowCatalog.forEach((definition) => map.set(definition.id, definition));
    return map;
  }, [flowCatalog]);

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    flowCatalog[0]?.id ?? "",
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    reorderFlowSteps(bot.id, activeId, overId);
  };

  const flowSteps = bot.flowSteps ?? [];

  return (
    <Card className="border border-border shadow-[var(--shadow-1)]">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Conversation flow</CardTitle>
          <CardDescription>
            Arrange the module sequence. Drag-and-drop ordering supported for quick edits.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedModuleId}
            onChange={(event) => setSelectedModuleId(event.target.value)}
            className="h-10 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-1)] transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {flowCatalog.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name} · {module.category === "collection" ? "Collect" : "Workflow"}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedModuleId) {
                addFlowStep(bot.id, selectedModuleId);
              }
            }}
            disabled={!selectedModuleId}
          >
            Add module
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {flowSteps.length > 0 ? (
          <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext
              items={flowSteps.map((step) => step.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {flowSteps.map((step, index) => {
                  const definition = flowDefinitionMap.get(step.moduleId);
                  return (
                    <SortableFlowItem key={step.id} stepId={step.id}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                            Step {index + 1} · {step.moduleId}
                          </p>
                          <h3 className="text-base font-semibold text-foreground">
                            {step.name}
                          </h3>
                          <p className="text-sm text-foreground/70">{step.summary}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border border-dashed border-border px-3 py-1 text-xs uppercase tracking-[0.18em]",
                              step.status === "Configured"
                                ? "bg-highlight/60 text-foreground"
                                : "text-foreground/70",
                            )}
                          >
                            {step.status}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={(definition?.fields.length ?? 0) === 0}
                            onClick={() => onConfigureStep(step.id)}
                          >
                            Configure
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFlowStep(bot.id, step.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </SortableFlowItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-foreground/70">
            No modules yet. Add collection or workflow modules from the catalog to build your
            automation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
