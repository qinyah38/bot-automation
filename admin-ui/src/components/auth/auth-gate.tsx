"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/state/auth-context";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground/60">
        {loading ? "Loading account…" : "Redirecting to login…"}
      </div>
    );
  }

  return <>{children}</>;
}
