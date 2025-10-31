"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBots } from "@/state/bots-context";

export default function BotsPage() {
  const { bots } = useBots();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Bots</h1>
          <p className="text-sm text-foreground/70">
            Manage flow versions and publish changes to each connected number.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/bots/new">Build WhatsApp bot</Link>
        </Button>
      </div>
      <div className="grid gap-4">
        {bots.map((bot) => (
          <Card
            key={bot.id}
            className="border border-dashed border-border shadow-[var(--shadow-1)] transition hover:shadow-[var(--shadow-2)]"
          >
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">{bot.name}</CardTitle>
                <CardDescription>
                  <span className="font-medium text-foreground/80">
                    {bot.status}
                  </span>{" "}
                  · Last update {bot.updatedLabel}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/bots/${bot.id}/builder`}>Open builder</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 text-sm text-foreground/70">
              <span>{bot.assignedNumbers.length} assigned numbers</span>
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span>Version {bot.version} · Locale {bot.locale}</span>
            </CardContent>
          </Card>
        ))}
        {bots.length === 0 && (
          <Card className="border border-dashed border-border bg-background/60 shadow-[var(--shadow-1)]">
            <CardHeader>
              <CardTitle>No bots yet</CardTitle>
              <CardDescription>
                Create your first bot to start collecting leads or supporting
                customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href="/bots/new">Build WhatsApp bot</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
