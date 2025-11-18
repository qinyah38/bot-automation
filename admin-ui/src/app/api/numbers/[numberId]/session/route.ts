import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceRoleClient } from "@/lib/supabase-server";

const paramsSchema = z.object({
  numberId: z.string().min(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: { numberId: string } },
) {
  const parsed = paramsSchema.safeParse(context.params);

  if (!parsed.success) {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const candidate = [...segments].reverse().find((segment) => uuidPattern.test(segment));
    if (candidate && uuidPattern.test(candidate)) {
      context.params.numberId = candidate;
      // continue with the normal flow below.
    }
  }

  const numberId = context.params.numberId;

  if (!numberId || !uuidPattern.test(numberId)) {
    return NextResponse.json({ error: "Invalid number id." }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("number_sessions")
    .select(
      `
        number_id,
        session_state,
        qr_token,
        qr_expires_at,
        last_error,
        runtime_metadata
      `,
    )
    .eq("number_id", numberId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ session: null }, { status: 200 });
    }
    return NextResponse.json(
      { error: "Failed to load session metadata." },
      { status: 500 },
    );
  }

  return NextResponse.json({ session: data }, { status: 200 });
}
