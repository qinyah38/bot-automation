"use client";

import { differenceInMinutes } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  onMarkScanned: (numberId: string) => Promise<void> | void;
  onRegenerate: (numberId: string) => Promise<void> | void;
};

export function NumberOnboardingDialog({
  open,
  number,
  onOpenChange,
  onMarkScanned,
  onRegenerate,
}: NumberOnboardingDialogProps) {
  const [session, setSession] = useState<{
    session_state: string;
    qr_token: string | null;
    qr_expires_at: string | null;
    last_error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !number) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/numbers/${number.id}/session`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? "Failed to fetch session state");
        }

        const payload = await response.json();
        if (cancelled) return;
        setSession(payload.session ?? null);
        setError(null);

        if (!payload.session || payload.session.session_state !== "connected") {
          if (!interval) {
            interval = setInterval(fetchSession, 5000);
          }
        } else if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unexpected error loading session");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchSession();

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [number, open]);

  useEffect(() => {
    if (!open) {
      setSession(null);
      setError(null);
    }
  }, [open]);

  const qrValue = session?.qr_token ?? number?.qrSvg ?? null;
  const qrStatusText = useMemo(() => {
    if (qrValue) return null;
    if (loading) return "Loading QR...";
    return "QR code will appear once the runtime provides it.";
  }, [loading, qrValue]);

  if (!number) return null;

  const expiresAt = session?.qr_expires_at ?? number.qrExpiresAt ?? null;
  const expiresInMinutes = expiresAt
    ? Math.max(differenceInMinutes(new Date(expiresAt), new Date()), 0)
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
          {session?.last_error && (
            <p className="mt-2 text-xs text-destructive">Last error: {session.last_error}</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-8 text-center">
          {qrValue ? (
            <>
              <QRCodeSVG value={qrValue} size={220} includeMargin className="h-auto w-full max-w-xs" />
              <p className="mt-4 text-xs text-foreground/60">
                If scanning fails, copy this token:{" "}
                <span className="break-all font-mono text-foreground/80">{qrValue}</span>
              </p>
            </>
          ) : (
            <p className="max-w-full break-words text-sm text-foreground/70">{qrStatusText}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {session?.session_state === "connected" && (
          <p className="text-sm text-foreground/70">
            Session connected. You can close this dialog once the device is ready.
          </p>
        )}

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
