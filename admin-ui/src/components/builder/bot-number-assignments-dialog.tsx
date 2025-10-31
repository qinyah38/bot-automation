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

type BotNumberAssignmentsDialogProps = {
  open: boolean;
  bot: Bot | null;
  numbers: WhatsAppNumber[];
  onOpenChange: (open: boolean) => void;
  onToggle: (numberId: string, assign: boolean) => void;
};

export function BotNumberAssignmentsDialog({
  open,
  bot,
  numbers,
  onOpenChange,
  onToggle,
}: BotNumberAssignmentsDialogProps) {
  if (!bot) return null;

  const assigned = new Set(bot.assignedNumbers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Assign numbers to {bot.name}</DialogTitle>
          <DialogDescription>
            Choose which WhatsApp numbers this bot should run on. Publish is required before changes affect the runtime.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-border px-4 py-3">
          {numbers.length === 0 ? (
            <p className="text-sm text-foreground/60">No numbers registered yet.</p>
          ) : (
            numbers.map((number) => {
              const checked = assigned.has(number.id);
              return (
                <label
                  key={number.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-border/80"
                >
                  <div>
                    <p className="font-medium text-foreground">{number.displayName}</p>
                    <p className="text-xs text-foreground/60">{number.phoneNumber} · {number.status}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    onChange={(event) => onToggle(number.id, event.target.checked)}
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
