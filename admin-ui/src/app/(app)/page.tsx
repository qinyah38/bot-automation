import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const stats = [
  { label: "Connected numbers", value: "6", delta: "+1 this week" },
  { label: "Active bot versions", value: "14", delta: "5 awaiting publish" },
  { label: "Daily conversations", value: "238", delta: "+12% vs yesterday" },
  { label: "Pending reviews", value: "3", delta: "QA needed" },
];

const activity = [
  {
    title: "Lead Capture v5 published",
    time: "18 minutes ago",
    detail: "Assigned to KSA Sales number",
  },
  {
    title: "WhatsApp reconnect required",
    time: "1 hour ago",
    detail: "Support Line – QR regenerated",
  },
  {
    title: "Webhook latency alert cleared",
    time: "Yesterday",
    detail: "CRM push back to normal levels",
  },
];

const libraryDrafts = [
  {
    name: "Arabic onboarding survey",
    author: "Sara Al-Qahtani",
    updated: "2h ago",
  },
  {
    name: "VIP escalation branch",
    author: "Omar N.",
    updated: "Yesterday",
  },
  {
    name: "Payment follow-up",
    author: "System",
    updated: "3 days ago",
  },
];

const lastSync = "09:24";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-dashed border-border bg-card/80 p-8 shadow-[var(--shadow-1)]">
          <Badge className="mb-6 w-fit border border-dashed border-border bg-highlight/60 text-foreground">
            Operations overview
          </Badge>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-foreground">
              Keep flows sharp and{" "}
              <span className="bg-highlight px-1">ready for handoff.</span>
            </h1>
            <p className="max-w-2xl text-base text-foreground/70">
              Review live conversations, publish module updates, and ensure each
              WhatsApp number stays authenticated. All edits respect the
              NeoSketch design system—no surprises when shipping new flows.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg">Open flow builder</Button>
            <Button variant="outline" size="lg">
              View conversation log
            </Button>
          </div>
        </div>
        <Card className="rounded-3xl border border-border shadow-[var(--shadow-1)]">
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
            <CardDescription>Last sync {lastSync}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-dashed border-border/80 bg-background px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
                <span className="text-sm text-primary">{item.delta}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
        <Card className="border border-dashed border-border shadow-[var(--shadow-1)]">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Latest activity across bots and numbers</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              See all activity
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((item) => (
              <div
                key={item.title}
                className="grid gap-1 border-l-2 border-dashed border-border pl-4"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/50">
                  {item.time}
                </p>
                <p className="text-sm text-foreground/70">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[var(--shadow-1)]">
          <CardHeader>
            <CardTitle>Library drafts</CardTitle>
            <CardDescription>Modules awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="drafts" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-background">
                <TabsTrigger value="drafts">Drafts</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
              </TabsList>
              <TabsContent value="drafts" className="mt-4 space-y-3">
                {libraryDrafts.map((draft) => (
                  <div
                    key={draft.name}
                    className="rounded-lg border border-dashed border-border/80 bg-background px-4 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">{draft.name}</p>
                    <p className="text-xs text-foreground/60">
                      {draft.author} · {draft.updated}
                    </p>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="published" className="mt-4 text-sm text-foreground/60">
                No recently published modules. Keep shipping!
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
