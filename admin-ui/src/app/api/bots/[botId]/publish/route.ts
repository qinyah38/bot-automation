import { NextRequest, NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { toBotUuid } from "@/lib/id-mapper";
import {
  publishBotRequestSchema,
  publishBotResponseSchema,
  type PublishBotRequest,
} from "@/lib/publish-contract";
import { getServiceRoleClient } from "@/lib/supabase-server";

type RouteParams = {
  params: Promise<{
    botId: string;
  }>;
};

function respondWithError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function handleDbError(error: PostgrestError, context: string) {
  return respondWithError(`DB_ERROR_${context}`, 500, {
    message: error.message,
    hint: error.hint,
    code: error.code,
    details: error.details,
  });
}

function buildFlowDefinition(payload: PublishBotRequest) {
  return {
    triggers: payload.flowDefinition.triggers,
    steps: payload.flowDefinition.steps,
    integrations: payload.flowDefinition.integrations,
    metadata: {
      locale: payload.locale,
      autoAssign: payload.autoAssign,
      assignedNumbers: payload.assignedNumbers,
      ...(payload.flowDefinition.metadata ?? {}),
    },
  };
}

export async function POST(req: NextRequest, context: RouteParams) {
  try {
    const { botId: rawBotId } = await context.params;

    if (!rawBotId) {
      return respondWithError("MISSING_BOT_ID");
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return respondWithError("INVALID_JSON");
    }

    const parsed = publishBotRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return respondWithError("INVALID_BODY", 422, parsed.error.flatten());
    }

    const payload = parsed.data;
    const supabase = getServiceRoleClient();
    const botId = toBotUuid(rawBotId);
    const now = new Date().toISOString();
    const actorId = payload.actorId ?? null;

    const { data: latestVersion, error: latestVersionError } = await supabase
      .from("bot_versions")
      .select("version_number, id")
      .eq("bot_id", botId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersionError) {
      return handleDbError(latestVersionError, "FETCH_BOT_VERSION");
    }

    const nextVersion = (latestVersion?.version_number ?? 0) + 1;

    if (actorId) {
      const { error: upsertUserError } = await supabase
        .from("users")
        .upsert(
          {
            id: actorId,
            email: payload.actorEmail ?? null,
            display_name: payload.actorName ?? payload.actorEmail ?? null,
            status: "active",
            updated_at: now,
          },
          { onConflict: "id" },
        );

      if (upsertUserError) {
        return handleDbError(upsertUserError, "UPSERT_ACTOR");
      }
    }

    const { data: existingBot, error: botFetchError } = await supabase
      .from("bots")
      .select("id")
      .eq("id", botId)
      .maybeSingle();

    if (botFetchError) {
      return handleDbError(botFetchError, "FETCH_BOT");
    }

    const { error: upsertError } = await supabase.from("bots").upsert(
      {
        id: botId,
        name: payload.name,
        description: payload.description ?? null,
        default_locale: payload.locale,
        owner_id: payload.ownerId ?? null,
        updated_at: now,
        ...(existingBot ? {} : { created_at: now }),
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      return handleDbError(upsertError, "UPSERT_BOT");
    }

    const { data: versionRow, error: versionInsertError } = await supabase
      .from("bot_versions")
      .insert({
        bot_id: botId,
        version_number: nextVersion,
        status: "published",
        flow_definition: buildFlowDefinition(payload),
        validation_errors: null,
        change_summary: payload.changeSummary.join("\n"),
        created_by: actorId,
        published_at: now,
      })
      .select("id")
      .single();

    if (versionInsertError) {
      return handleDbError(versionInsertError, "INSERT_BOT_VERSION");
    }

    const { error: botUpdateError } = await supabase
      .from("bots")
      .update({
        current_version_id: versionRow.id,
        updated_at: now,
      })
      .eq("id", botId);

    if (botUpdateError) {
      return handleDbError(botUpdateError, "UPDATE_BOT_POINTER");
    }

    const actorType = payload.actorId ? "user" : "system";

    const { error: auditError } = await supabase.from("audit_log_entries").insert({
      actor_id: payload.actorId ?? null,
      actor_type: actorType,
      action: "bot_published",
      entity_type: "bot",
      entity_id: botId,
      metadata: {
        botId,
        version: nextVersion,
        requestedVersion: payload.requestedVersion,
        changeSummary: payload.changeSummary,
        assignedNumbers: payload.assignedNumbers,
        triggerCount: payload.flowDefinition.triggers.length,
        stepCount: payload.flowDefinition.steps.length,
      },
    });

    if (auditError) {
      return handleDbError(auditError, "AUDIT_LOG");
    }

    const response = publishBotResponseSchema.parse({
      botId,
      botVersionId: versionRow.id,
      version: nextVersion,
      status: "published",
      publishedAt: now,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Publish bot route failed", error);
    return respondWithError("SERVER_ERROR", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
