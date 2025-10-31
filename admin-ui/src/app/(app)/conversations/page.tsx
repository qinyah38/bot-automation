import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const conversations = [
  {
    customer: "Fatimah A.",
    number: "KSA Sales",
    status: "Bot resolving",
    updated: "2 mins ago",
  },
  {
    customer: "Ali M.",
    number: "Support Line",
    status: "Escalated to agent",
    updated: "8 mins ago",
  },
  {
    customer: "Noor H.",
    number: "UAE Leads",
    status: "Awaiting reply",
    updated: "14 mins ago",
  },
];

export default function ConversationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Conversations</h1>
        <p className="text-sm text-foreground/70">
          Inspect live threads, push manual responses, and monitor escalation paths.
        </p>
      </div>

      <Tabs defaultValue="live">
        <TabsList className="bg-background">
          <TabsTrigger value="live">Live queue</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4 space-y-4">
          {conversations.map((conversation) => (
            <Card key={conversation.customer} className="border border-dashed border-border shadow-[var(--shadow-1)]">
              <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{conversation.customer}</CardTitle>
                  <CardDescription>{conversation.number}</CardDescription>
                </div>
                <span className="rounded-full border border-dashed border-border bg-highlight/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-foreground">
                  {conversation.status}
                </span>
              </CardHeader>
              <CardContent className="text-sm text-foreground/70">
                Last activity {conversation.updated}. Playback and message timeline will live here.
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="archived" className="mt-4 text-sm text-foreground/60">
          Archive view coming soon. Filter by bot version, outcome, or tags.
        </TabsContent>
        <TabsContent value="alerts" className="mt-4 text-sm text-foreground/60">
          No active alerts. Synthetic monitoring passes all checks.
        </TabsContent>
      </Tabs>
    </div>
  );
}
