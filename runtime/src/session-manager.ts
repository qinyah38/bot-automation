import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import WhatsAppWebJs from "whatsapp-web.js";
import type { BotExecutor } from "./bot-executor.js";

const { Client, LocalAuth } = WhatsAppWebJs;
type Message = WhatsAppWebJs.Message;

type NumberStatus = "pending_qr" | "connected" | "disconnected" | string;

type NumbersRow = {
  id: string;
  phone_number: string;
  status: NumberStatus;
};

type ConversationMeta = {
  conversationId: string;
  botVersionId: string | null;
  customerWaId: string;
};

type NumberBotBinding = {
  deploymentId: string;
  botVersionId: string | null;
};

type SessionManagerOptions = {
  sessionDataDir: string;
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    debug?: (msg: string, meta?: Record<string, unknown>) => void;
  };
  qrExpirySeconds?: number;
  botCacheTtlMs?: number;
  executor?: BotExecutor;
};

export class SessionManager {
  private readonly clients = new Map<string, WhatsAppWebJs.Client>();
  private isShuttingDown = false;
  private readonly logger: SessionManagerOptions["logger"];
  private readonly botBindingCache = new Map<string, { binding: NumberBotBinding | null; expiresAt: number }>();
  private readonly botCacheTtlMs: number;
  private readonly executor?: BotExecutor;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly options: SessionManagerOptions,
  ) {
    this.logger = options.logger;
    this.botCacheTtlMs = options.botCacheTtlMs ?? 60_000;
    this.executor = options.executor;
  }
  

  async initialize() {
    await fs.mkdir(this.options.sessionDataDir, { recursive: true });
  }

  async syncPendingNumbers() {
    if (this.isShuttingDown) return;

    const statusesToSync: NumberStatus[] = ["pending_qr"];

    const { data, error } = await this.supabase
      .from("numbers")
      .select("id, phone_number, status")
      .in("status", statusesToSync);

    console.log("Numbers to sync", data);

    if (error) {
      this.logger.error("Failed to fetch numbers", { error });
      return null;
    }

    const numbers = (data ?? []) as NumbersRow[];

    for (const number of numbers) {
      console.log("Syncing number", number.id);
      if (this.clients.has(number.id)) {
        console.log("Number already has a client", number.id);
        continue;
      }
      console.log("Ensuring session for number", number.id);
      await this.ensureSession(number);
      console.log("Session ensured for number", number.id);
    }
  }

  private async ensureSession(number: NumbersRow) {
    const client = new Client({
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      authStrategy: new LocalAuth({
        dataPath: path.resolve(this.options.sessionDataDir),
        clientId: number.id,
      }),
    });

    this.clients.set(number.id, client);
    this.logger.info("Initialising WhatsApp client", { numberId: number.id });

    client.on("qr", async (qr) => {
      this.logger.info("QR generated", { numberId: number.id });
      await this.persistQr(number.id, qr);
    });

    client.on("ready", async () => {
      this.logger.info("WhatsApp client ready", { numberId: number.id });
      await this.updateNumberStatus(number.id, "connected");
      await this.logConnectionEvent(number.id, "connected");
    });

    client.on("auth_failure", async (message) => {
      this.logger.error("Authentication failure", { numberId: number.id, message });
      await this.updateNumberStatus(number.id, "disconnected");
      await this.logConnectionEvent(number.id, "auth_failure", { message });
    });

    client.on("disconnected", async (reason) => {
      this.logger.warn("WhatsApp client disconnected", { numberId: number.id, reason });
      await this.updateNumberStatus(number.id, "disconnected");
      await this.logConnectionEvent(number.id, "disconnected", { reason });
      this.clients.delete(number.id);

      if (!this.isShuttingDown) {
        await sleep(5_000);
        await this.ensureSession(number);
      }
    });

    client.on("message", (message) => {
      if (message.fromMe) return;
      void this.handleMessageEvent(number, message, "inbound");
    });

    client.on("message_create", (message) => {
      if (!message.fromMe) return;
      void this.handleMessageEvent(number, message, "outbound");
    });

    console.log("Initialising2 WhatsApp client", { numberId: number.id });

    try {
      await client.initialize();
    } catch (error) {
      this.logger.error("Failed to initialise WhatsApp client", { numberId: number.id, error });
      this.clients.delete(number.id);
    }
  }

  private async handleMessageEvent(
    number: NumbersRow,
    message: Message,
    direction: "inbound" | "outbound",
  ) {
    let conversationMeta: ConversationMeta | null = null;
    try {
      conversationMeta = await this.persistMessage(number.id, message, direction);
    } catch (error) {
      this.logger.error("Failed to persist message", {
        numberId: number.id,
        messageId: message.id?._serialized,
        direction,
        error,
      });
    }

    if (direction === "inbound" && conversationMeta) {
      void this.runBotExecutor(number.id, conversationMeta, message);
    }
  }

  private getMessageCounterparty(message: Message, direction: "inbound" | "outbound") {
    if (direction === "inbound") {
      return message.from || message.author || null;
    }
    return message.to || message.from || null;
  }

  private serializeMessage(message: Message) {
    return {
      id: message.id?._serialized,
      from: message.from,
      to: message.to,
      author: message.author,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp,
      fromMe: message.fromMe,
      hasMedia: message.hasMedia,
      ack: message.ack,
      deviceType: message.deviceType,
      hasQuotedMsg: message.hasQuotedMsg,
    };
  }

  private async persistMessage(
    numberId: string,
    message: Message,
    direction: "inbound" | "outbound",
  ): Promise<ConversationMeta | null> {
    const customerWaId = this.getMessageCounterparty(message, direction);
    if (!customerWaId) {
      this.logger.warn("Unable to determine counterparty for message", {
        numberId,
        direction,
        messageId: message.id?._serialized,
      });
      return null;
    }

    const conversation = await this.ensureConversation(numberId, customerWaId);
    if (!conversation) return null;
    const conversationId = conversation.conversationId;

    const sentAt = message.timestamp
      ? new Date(message.timestamp * 1000).toISOString()
      : new Date().toISOString();

    const payload = this.serializeMessage(message);
    const deliveryStatus = direction === "outbound" ? "pending" : "delivered";

    const { error } = await this.supabase.from("messages").insert({
      conversation_id: conversationId,
      direction,
      message_type: message.type ?? "text",
      payload,
      sent_at: sentAt,
      delivery_status: deliveryStatus,
    });

    if (error) {
      this.logger.error("Failed to insert message", {
        numberId,
        conversationId,
        direction,
        error,
      });
      return null;
    }

    const { error: convoUpdateError } = await this.supabase
      .from("conversations")
      .update({ last_message_at: sentAt, status: "open" })
      .eq("id", conversationId);

    if (convoUpdateError) {
      this.logger.error("Failed to update conversation metadata", {
        numberId,
        conversationId,
        error: convoUpdateError,
      });
    }
    return {
      conversationId,
      botVersionId: conversation.botVersionId,
      customerWaId,
    };
  }

  private async ensureConversation(numberId: string, customerWaId: string): Promise<ConversationMeta | null> {
    const botBinding = await this.getActiveBotBinding(numberId);
    const { data, error } = await this.supabase
      .from("conversations")
      .select("id, bot_version_id")
      .eq("number_id", numberId)
      .eq("customer_wa_id", customerWaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      this.logger.error("Failed to load conversation", { numberId, customerWaId, error });
      return null;
    }

    if (data?.id) {
      if (botBinding?.botVersionId && data.bot_version_id !== botBinding.botVersionId) {
        const { error: updateError } = await this.supabase
          .from("conversations")
          .update({ bot_version_id: botBinding.botVersionId })
          .eq("id", data.id);

        if (updateError) {
          this.logger.warn("Failed to refresh conversation bot binding", {
            numberId,
            conversationId: data.id,
            error: updateError,
          });
        }
      }
      return {
        conversationId: data.id as string,
        botVersionId: (data.bot_version_id as string | null) ?? botBinding?.botVersionId ?? null,
        customerWaId,
      };
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await this.supabase
      .from("conversations")
      .insert({
        number_id: numberId,
        customer_wa_id: customerWaId,
        bot_version_id: botBinding?.botVersionId ?? null,
        status: "open",
        opened_at: now,
        last_message_at: now,
      })
      .select("id, bot_version_id")
      .single();

    if (insertError) {
      this.logger.error("Failed to create conversation", { numberId, customerWaId, error: insertError });
      return null;
    }

    return {
      conversationId: inserted?.id as string,
      botVersionId: (inserted?.bot_version_id as string | null) ?? botBinding?.botVersionId ?? null,
      customerWaId,
    };
  }

  private async getActiveBotBinding(numberId: string): Promise<NumberBotBinding | null> {
    const cached = this.botBindingCache.get(numberId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.binding;
    }

    const { data, error } = await this.supabase
      .from("number_bot_deployments")
      .select("id, bot_version_id")
      .eq("number_id", numberId)
      .eq("status", "active")
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      this.logger.error("Failed to load bot deployment", { numberId, error });
      const expiresAt = Date.now() + this.botCacheTtlMs;
      this.botBindingCache.set(numberId, { binding: null, expiresAt });
      return null;
    }

    const binding = data
      ? {
          deploymentId: data.id as string,
          botVersionId: data.bot_version_id as string | null,
        }
      : null;

    const expiresAt = Date.now() + this.botCacheTtlMs;
    this.botBindingCache.set(numberId, { binding, expiresAt });
    return binding;
  }

  private async runBotExecutor(numberId: string, meta: ConversationMeta, message: Message) {
    if (!this.executor) return;
    const client = this.clients.get(numberId);
    if (!client) return;

    try {
      const responses = (await this.executor.handleInboundMessage({
        numberId,
        conversationId: meta.conversationId,
        botVersionId: meta.botVersionId,
        message,
      })) ?? [];

      for (const response of responses) {
        if (!response.chatId) continue;
        if (response.type !== "text") {
          this.logger.warn("Unsupported bot response type", {
            numberId,
            conversationId: meta.conversationId,
            responseType: response.type,
          });
          continue;
        }

        try {
          await client.sendMessage(response.chatId, response.body);
        } catch (error) {
          this.logger.error("Failed to send bot response", {
            numberId,
            conversationId: meta.conversationId,
            error,
          });
        }
      }
    } catch (error) {
      this.logger.error("Bot executor failed", {
        numberId,
        conversationId: meta.conversationId,
        error,
      });
    }
  }

  async shutdown() {
    this.isShuttingDown = true;
    this.logger.info("Shutting down session manager");
    for (const [numberId, client] of this.clients.entries()) {
      try {
        await client.destroy();
        this.logger.info("Destroyed WhatsApp client", { numberId });
      } catch (error) {
        this.logger.error("Failed to destroy client", { numberId, error });
      }
    }
    this.clients.clear();
  }

  private async persistQr(numberId: string, qr: string) {
    const qrExpiresAt = new Date(
      Date.now() + (this.options.qrExpirySeconds ?? 60) * 1000,
    ).toISOString();

    const { error } = await this.supabase
      .from("number_sessions")
      .upsert(
        {
          number_id: numberId,
          session_state: "pending_qr",
          qr_token: qr,
          qr_expires_at: qrExpiresAt,
        },
        { onConflict: "number_id" },
      );

    if (error) {
      this.logger.error("Failed to persist QR", { numberId, error });
    } else {
      await this.updateNumberStatus(numberId, "pending_qr");
      await this.logConnectionEvent(numberId, "qr_generated");
    }
  }

  private async updateNumberStatus(numberId: string, status: NumberStatus) {
    const { error } = await this.supabase
      .from("numbers")
      .update({
        status,
        last_connected_at: status === "connected" ? new Date().toISOString() : null,
      })
      .eq("id", numberId);

    if (error) {
      this.logger.error("Failed to update number status", { numberId, error });
    }
  }

  private async logConnectionEvent(
    numberId: string,
    eventType: string,
    payload?: Record<string, unknown>,
  ) {
    const { error } = await this.supabase
      .from("number_connection_events")
      .insert({
        number_id: numberId,
        event_type: eventType,
        payload: payload ?? {},
      });

    if (error) {
      this.logger.error("Failed to log connection event", { numberId, error });
    }
  }
}
