"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNumbers } from "@/state/numbers-context";
import { useBots } from "@/state/bots-context";
import { RegisterNumberDialog } from "@/components/numbers/register-number-dialog";
import { NumberOnboardingDialog } from "@/components/numbers/number-onboarding-dialog";
import { NumberAssignmentsDialog } from "@/components/numbers/number-assignments-dialog";

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  Connected: "default",
  "Pending QR": "secondary",
  Disconnected: "outline",
  Suspended: "outline",
};

export default function NumbersPage() {
  const {
    numbers,
    registerNumber,
    updateNumberStatus,
    assignNumberToBot,
    regenerateQr,
    markQrScanned,
  } = useNumbers();
  const { bots, setBotNumberAssignment } = useBots();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [onboardingNumber, setOnboardingNumber] = useState<
    string | null
  >(null);
  const [assignNumberId, setAssignNumberId] = useState<string | null>(null);

  const sortedNumbers = useMemo(
    () =>
      [...numbers].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [numbers],
  );

  const botsById = useMemo(() => {
    const map = new Map<string, string>();
    bots.forEach((bot) => map.set(bot.id, bot.name));
    return map;
  }, [bots]);

  const onboardingNumberObj = onboardingNumber
    ? numbers.find((number) => number.id === onboardingNumber) ?? null
    : null;

  const assignmentNumberObj = assignNumberId
    ? numbers.find((number) => number.id === assignNumberId) ?? null
    : null;

  const handleAssignmentToggle = (numberId: string, botId: string, assign: boolean) => {
    assignNumberToBot(numberId, botId, assign);
    setBotNumberAssignment(botId, numberId, assign);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Numbers</h1>
          <p className="text-sm text-foreground/70">
            Onboard WhatsApp numbers, monitor session health, and trigger reconnection steps.
          </p>
        </div>
        <Button size="sm" onClick={() => setRegisterOpen(true)}>
          Register number
        </Button>
      </div>

      <div className="grid gap-4">
        {sortedNumbers.map((number) => {
          const assignedBotNames = number.assignedBotIds
            .map((id) => botsById.get(id) ?? id)
            .join(", ");

          return (
            <Card
              key={number.id}
              className="border border-dashed border-border shadow-[var(--shadow-1)]"
            >
              <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{number.displayName}</CardTitle>
                  <CardDescription>{number.phoneNumber}</CardDescription>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                    Region: {number.region}
                  </p>
                  {assignedBotNames && (
                    <p className="text-xs text-foreground/60">
                      Bots: {assignedBotNames}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE[number.status] ?? "secondary"}>
                  {number.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4 text-sm text-foreground/70">
                <span>{number.lastSeen}</span>
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                <Button size="sm" variant="ghost" onClick={() => setAssignNumberId(number.id)}>
                  Manage assignments
                </Button>
                {number.status === "Pending QR" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOnboardingNumber(number.id)}
                    >
                      View QR
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => regenerateQr(number.id)}>
                      Regenerate QR
                    </Button>
                    <Button size="sm" onClick={() => markQrScanned(number.id)}>
                      Mark scanned
                    </Button>
                  </>
                ) : number.status === "Connected" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateNumberStatus(number.id, "Disconnected", {
                        lastSeen: "Manual disconnect",
                      })
                    }
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => regenerateQr(number.id)}>
                    Reconnect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {sortedNumbers.length === 0 && (
          <Card className="border border-dashed border-border bg-background/60 shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>No numbers yet</CardTitle>
              <CardDescription>
                Register your first WhatsApp number to start authenticating bots.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" onClick={() => setRegisterOpen(true)}>
                Register number
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <RegisterNumberDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSubmit={async (values) => {
          try {
            const newNumber = await registerNumber(values);
            setOnboardingNumber(newNumber.id);
          } catch (error) {
            console.error("Failed to register number", error);
          }
        }}
      />

      <NumberOnboardingDialog
        open={Boolean(onboardingNumberObj)}
        number={onboardingNumberObj}
        onOpenChange={(open) => {
          if (!open) setOnboardingNumber(null);
        }}
        onMarkScanned={(numberId) => {
          markQrScanned(numberId);
          setOnboardingNumber(null);
        }}
        onRegenerate={(numberId) => regenerateQr(numberId)}
      />

      <NumberAssignmentsDialog
        open={Boolean(assignmentNumberObj)}
        number={assignmentNumberObj}
        bots={bots}
        onOpenChange={(open) => {
          if (!open) setAssignNumberId(null);
        }}
        onToggle={(botId, checked) => {
          if (!assignmentNumberObj) return;
          handleAssignmentToggle(assignmentNumberObj.id, botId, checked);
        }}
      />
    </div>
  );
}
