import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-foreground/70">
          Configure workspace metadata, Supabase credentials, and security controls.
        </p>
      </div>

      <Card className="border border-border shadow-[var(--shadow-1)]">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground/70">
          <div>
            <h2 className="text-sm font-medium text-foreground">Name</h2>
            <p>Botauto Ops</p>
          </div>
          <Separator />
          <div>
            <h2 className="text-sm font-medium text-foreground">Default region</h2>
            <p>eu-central-1 (Supabase)</p>
          </div>
          <Separator />
          <div>
            <h2 className="text-sm font-medium text-foreground">RBAC</h2>
            <p>Roles: admin, editor, viewer. Enforced via Admin API and Postgres policies.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
