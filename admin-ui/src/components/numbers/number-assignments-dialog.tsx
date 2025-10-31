"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot } from "@/state/bots-context";
import { WhatsAppNumber } from "@/state/numbers-context";

type NumberAssignmentsDialogProps = {
  open: boolean;
  number: WhatsAppNumber | null;
  bots: Bot[];
  onOpenChange: (open: boolean) => void;
  onToggle: (botId: string, assign: boolean) => void;
};

export function NumberAssignmentsDialog({
  open,
  number,
  bots,
  onOpenChange,
  onToggle,
}: NumberAssignmentsDialogProps) {
  if (!number) return null;

  const assigned = new Set(number.assignedBotIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Assign {number.displayName} to bots</DialogTitle>
          <DialogDescription>
            Select which bot runtimes use this WhatsApp number. Changes take effect after publish.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-border px-4 py-3">
          {bots.length === 0 ? (
            <p className="text-sm text-foreground/60">No bots available yet. Create a bot first.</p>
          ) : (
            bots.map((bot) => {
              const checked = assigned.has(bot.id);
              return (
                <label
                  key={bot.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-border/80"
                >
                  <div>
                    <p className="font-medium text-foreground">{bot.name}</p>
                    <p className="text-xs text-foreground/60">Version {bot.version} · {bot.status}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    onChange={(event) => onToggle(bot.id, event.target.checked)}
                  />
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
