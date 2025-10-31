"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/state/auth-context";

export default function LoginPage() {
  const { session, loading, signInWithPassword } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/bots");
    }
  }, [loading, router, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        intent: "error",
      });
      return;
    }
    toast({
      title: "Welcome back",
      description: "Redirecting to your workspace…",
      intent: "success",
    });
    router.replace("/bots");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border border-border shadow-[var(--shadow-2)]">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Sign in to NeoSketch</CardTitle>
          <CardDescription>
            Use your Supabase credentials. Phone-based OTP login will arrive soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-foreground/60">
            Need an account?{" "}
            <Link href="https://app.supabase.com" className="text-highlight hover:underline">
              Contact an admin
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
