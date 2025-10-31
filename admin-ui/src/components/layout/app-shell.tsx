"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth-context";

const NAVIGATION = [
  { label: "Dashboard", href: "/" },
  { label: "Bots", href: "/bots" },
  { label: "Numbers", href: "/numbers" },
  { label: "Conversations", href: "/conversations" },
  { label: "Settings", href: "/settings" },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]"
            >
              <span className="h-3 w-3 rounded-full border border-border bg-highlight shadow-[0_1px_0_rgba(0,0,0,0.12)]" />
              NeoSketch Admin
            </Link>
            <nav className="hidden items-center gap-4 text-sm md:flex">
              {NAVIGATION.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-2 py-1 transition-colors",
                      isActive
                        ? "bg-highlight/80 text-foreground"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col text-right text-xs text-foreground/70 md:flex">
              <span className="font-semibold text-foreground">{user?.email ?? "Anonymous"}</span>
              {user?.phone && <span>{user.phone}</span>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
