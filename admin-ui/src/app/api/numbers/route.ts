import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceRoleClient } from "@/lib/supabase-server";

const REGISTER_NUMBER_SCHEMA = z.object({
  displayName: z.string().min(1).max(120),
  phoneNumber: z.string().min(6).max(32),
  region: z.string().min(2).max(8),
  notes: z.string().max(1024).optional(),
  autoAssignPreferred: z.boolean().optional().default(true),
});

function normalizePhoneNumber(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  return `+${digits}`;
}

const NUMBER_SELECT = `
  id,
  phone_number,
  display_name,
  region,
  status,
  notes,
  last_connected_at,
  created_at,
  auto_assign_preferred,
  number_bot_deployments:number_bot_deployments_number_id_fkey (
    status,
    bot_version_id
  )
`;

export async function POST(request: Request) {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = REGISTER_NUMBER_SCHEMA.safeParse(json);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { displayName, phoneNumber, region, notes, autoAssignPreferred } = parsed.data;
  const trimmedNotes = notes?.trim();
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "Phone number must be in E.164 format (e.g., +966512345678)." },
      { status: 400 },
    );
  }

  const normalizedRegion = region.trim().toUpperCase();

  const supabase = getServiceRoleClient();

  const { data: inserted, error: insertError } = await supabase
    .from("numbers")
    .insert({
      phone_number: normalizedPhone,
      display_name: displayName,
      region: normalizedRegion,
      status: "pending_qr",
      notes: trimmedNotes && trimmedNotes.length > 0 ? trimmedNotes : null,
      auto_assign_preferred: autoAssignPreferred,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "A WhatsApp number with this phone number already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to insert number", insertError);
    const description = insertError?.message ?? "Unable to register number. Please try again.";
    return NextResponse.json({ error: description }, { status: 500 });
  }

  const { data: numberRow, error: fetchError } = await supabase
    .from("numbers")
    .select(NUMBER_SELECT)
    .eq("id", inserted.id)
    .single();

  if (fetchError || !numberRow) {
    console.error("Failed to load number after insert", fetchError);
    const description = fetchError?.message ?? "Number was created but could not be loaded.";
    return NextResponse.json({ error: description }, { status: 500 });
  }

  return NextResponse.json({ number: numberRow }, { status: 201 });
}
