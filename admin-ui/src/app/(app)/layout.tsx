import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { BotsProvider } from "@/state/bots-context";
import { NumbersProvider } from "@/state/numbers-context";
import { AuthGate } from "@/components/auth/auth-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NumbersProvider>
      <BotsProvider>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </BotsProvider>
    </NumbersProvider>
  );
}
