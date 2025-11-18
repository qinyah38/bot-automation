import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceRoleClient } from "@/lib/supabase-server";

const paramsSchema = z.object({
  numberId: z.string().min(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
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
    } else {
      return NextResponse.json({ error: "Invalid number id." }, { status: 400 });
    }
  }

  const numberId = context.params.numberId;

  if (!uuidPattern.test(numberId)) {
    return NextResponse.json({ error: "Number is not yet saved to Supabase." }, { status: 400 });
  }

  const supabase = getServiceRoleClient();

  const [{ error: updateError }, { error: sessionError }, { error: eventError }] = await Promise.all([
    supabase
      .from("numbers")
      .update({ status: "pending_qr" })
      .eq("id", numberId),
    supabase
      .from("number_sessions")
      .upsert(
        {
          number_id: numberId,
          session_state: "pending_qr",
          qr_token: null,
          qr_expires_at: null,
        },
        { onConflict: "number_id" },
      ),
    supabase
      .from("number_connection_events")
      .insert({ number_id: numberId, event_type: "restart_requested" }),
  ]);

  if (updateError || sessionError || eventError) {
    // Surface enough detail during development to speed up debugging.
    console.error("Failed to request session restart", {
      numberId,
      updateError,
      sessionError,
      eventError,
    });
    return NextResponse.json(
      {
        error: "Failed to request session restart.",
        details: { updateError, sessionError, eventError },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
