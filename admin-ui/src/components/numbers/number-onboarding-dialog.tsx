"use client";

import { differenceInMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppNumber } from "@/state/numbers-context";

type NumberOnboardingDialogProps = {
  open: boolean;
  number?: WhatsAppNumber | null;
  onOpenChange: (open: boolean) => void;
  onMarkScanned: (numberId: string) => void;
  onRegenerate: (numberId: string) => void;
};

export function NumberOnboardingDialog({
  open,
  number,
  onOpenChange,
  onMarkScanned,
  onRegenerate,
}: NumberOnboardingDialogProps) {
  if (!number) return null;

  const expiresInMinutes = number.qrExpiresAt
    ? Math.max(differenceInMinutes(new Date(number.qrExpiresAt), new Date()), 0)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-6">
        <DialogHeader>
          <DialogTitle>Scan QR to connect {number.displayName}</DialogTitle>
          <DialogDescription>
            Share this QR code with the operator who will authenticate the WhatsApp session.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6">
          <p className="text-sm text-foreground/70">
            Phone: <span className="font-medium text-foreground">{number.phoneNumber}</span>
          </p>
          <p className="text-sm text-foreground/70">
            Status: <span className="font-medium text-foreground">{number.status}</span>
          </p>
          <p className="text-sm text-foreground/70">
            QR expires in: {expiresInMinutes !== undefined ? `${expiresInMinutes} min` : "--"}
          </p>
        </div>

        <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-8 text-center">
          <pre className="text-xs text-foreground/70">
            {number.qrSvg ?? "QR code will appear here once generated."}
          </pre>
        </div>

        <DialogFooter className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onRegenerate(number.id)}
          >
            Regenerate QR
          </Button>
          <Button onClick={() => onMarkScanned(number.id)}>Mark as scanned</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
