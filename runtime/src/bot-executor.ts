import type WhatsAppWebJs from "whatsapp-web.js";

export type BotExecutorRequest = {
  numberId: string;
  conversationId: string;
  botVersionId: string | null;
  message: WhatsAppWebJs.Message;
};

export type BotExecutorResponse =
  | {
      chatId: string;
      type: "text";
      body: string;
    };

export interface BotExecutor {
  handleInboundMessage(request: BotExecutorRequest): Promise<BotExecutorResponse[]>;
}

export class EchoBotExecutor implements BotExecutor {
  async handleInboundMessage(request: BotExecutorRequest): Promise<BotExecutorResponse[]> {
    const preview = request.message.body?.trim() ?? "";
    const reply = preview
      ? `Echo (${request.botVersionId ?? "no-bot"}): ${preview.slice(0, 200)}`
      : `Echo (${request.botVersionId ?? "no-bot"})`;

    return [
      {
        chatId: request.message.from,
        type: "text",
        body: reply,
      },
    ];
  }
}
