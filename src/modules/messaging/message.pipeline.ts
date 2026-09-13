import { InboundMessage } from "./message.types.js";
import { accessControlService } from "../permissions/access-control.service.js";
import { idempotencyService } from "./idempotency.service.js";
import { aiService } from "../ai/ai.service.js";
import { whatsAppProviderHolder } from "../whatsapp/whatsapp.holder.js";
import { notesService } from "../notes/notes.service.js";
import { remindersService } from "../reminders/reminders.service.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { AIMediaAttachment } from "../ai/ai-provider.interface.js";
import { SenderType } from "@prisma/client";

export class MessagePipeline {
  /**
   * Main entry pipeline for every incoming message.
   */
  async handleInbound(message: InboundMessage): Promise<void> {
    const start = Date.now();
    logger.info(
      { from: message.fromJid, type: message.type, id: message.id },
      "Inbound message received in pipeline"
    );

    // 1. Edge Access Control
    const authResult = await accessControlService.authorize(message.fromJid, message.senderName);
    if (!authResult.isAllowed || !authResult.user) {
      logger.warn({ sender: message.fromJid }, "Dropping unauthorized message");
      return;
    }

    const user = authResult.user;

    // 2. Idempotency Gate (deduplication)
    const isNew = await idempotencyService.acquireMessageLock(message.id);
    if (!isNew) {
      logger.info({ messageId: message.id }, "Dropping duplicated message event");
      return;
    }

    // 3. Rate Limiting Check
    const rateCheck = await idempotencyService.checkRateLimit(user.id);
    const whatsapp = whatsAppProviderHolder.getProvider();
    if (!rateCheck.allowed) {
      logger.warn({ userId: user.id }, "Rate limit exceeded for user");
      if (whatsapp) {
        await whatsapp.sendMessage(
          user.jid,
          "⚠️ Mohon maaf, Anda mengirim pesan terlalu cepat. Mohon tunggu sebentar sebelum mengirim pesan baru."
        );
      }
      return;
    }

    // 4. Get or create active conversation
    let conversation = await prisma.conversation.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: "Percakapan Asisten",
        },
      });
    }

    // 5. Handle explicit slash commands (deterministic fast path)
    const trimmedBody = message.body.trim();
    if (trimmedBody.startsWith("/")) {
      const handled = await this.handleSlashCommand(trimmedBody, user);
      if (handled && whatsapp) {
        await whatsapp.sendMessage(user.jid, handled);
        return;
      }
    }

    // 6. Handle Multimodal Media & Natural Language AI
    const mediaAttachments: AIMediaAttachment[] = [];
    let promptText = message.body;

    if (message.type === "voice" && message.mediaBuffer) {
      mediaAttachments.push({
        mimeType: message.mediaMimeType || "audio/ogg",
        data: message.mediaBuffer,
      });
      if (!promptText) {
        promptText = "Pengguna mengirim rekaman suara (voice note). Tolong dengarkan dan tanggapi pesan suara tersebut.";
      }
    } else if (message.type === "image" && message.mediaBuffer) {
      mediaAttachments.push({
        mimeType: message.mediaMimeType || "image/jpeg",
        data: message.mediaBuffer,
      });
      if (!promptText) {
        promptText = "Pengguna mengirim gambar ini. Tolong jelaskan atau tanggapi gambar tersebut.";
      }
    }

    // Persist incoming user message to PostgreSQL
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: message.id,
        senderType: SenderType.USER,
        content: promptText || `[Media ${message.type}]`,
        contentType: message.type.toUpperCase(),
      },
    });

    // Process turn with AI Agent
    try {
      const response = await aiService.processUserMessage({
        user,
        conversationId: conversation.id,
        messageId: message.id,
        userPrompt: promptText,
        media: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      });

      // Persist assistant message to PostgreSQL
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: SenderType.ASSISTANT,
          content: response.reply,
          tokenCount: response.tokenCount,
        },
      });

      // Dispatch reply via WhatsApp
      if (whatsapp) {
        await whatsapp.sendMessage(user.jid, response.reply);
      }

      logger.info(
        { userId: user.id, durationMs: Date.now() - start, tokens: response.tokenCount },
        "Processed inbound message successfully"
      );
    } catch (err: unknown) {
      logger.error({ userId: user.id, err }, "Error generating AI response for message");
      if (whatsapp) {
        await whatsapp.sendMessage(
          user.jid,
          "Maaf, terjadi kendala saat memproses permintaan Anda. Mohon coba sesaat lagi."
        );
      }
    }
  }

  /**
   * Deterministic handler for explicit slash commands.
   */
  private async handleSlashCommand(command: string, user: any): Promise<string | null> {
    const parts = command.split(" ");
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(" ").trim();

    switch (cmd) {
      case "/help":
        return (
          `🤖 *BANTUAN ASISTEN AI:*\n\n` +
          `• Anda bisa mengobrol santai langsung dengan teks atau pesan suara.\n` +
          `• *Catatan*: Tulis _"Catat: [isi]"_ atau gunakan command _/note [isi]_.\n` +
          `• *Pengingat*: Tulis _"Ingatkan saya besok jam 8 [isi]"_.\n` +
          `• *Rangkum Web*: Kirim tautan diawali _"Rangkum https://..."_.\n` +
          `• *Memori*: Katakan _"Ingat saya suka..."_ agar saya mengingatnya.\n` +
          `• /notes - Melihat daftar catatan tersimpan\n` +
          `• /reminders - Melihat daftar pengingat aktif\n` +
          `• /status - Memeriksa status kesehatan server (Admin)`
        );

      case "/note":
        if (!arg) return "Gunakan format: /note [isi catatan Anda]";
        await notesService.createNote(user.id, arg);
        return "✅ Catatan Anda berhasil disimpan.";

      case "/notes": {
        const notes = await notesService.listNotes(user.id, 5);
        if (notes.length === 0) return "Anda belum memiliki catatan tersimpan.";
        return (
          `📝 *CATATAN TERBARU ANDA:*\n\n` +
          notes.map((n, i) => `${i + 1}. ${n.content} _(${n.createdAt.toLocaleDateString("id-ID")})_`).join("\n")
        );
      }

      case "/reminders": {
        const reminders = await remindersService.listReminders(user.id);
        if (reminders.length === 0) return "Tidak ada pengingat aktif saat ini.";
        return (
          `⏰ *PENGINGAT AKTIF ANDA:*\n\n` +
          reminders
            .map(
              (r, i) =>
                `${i + 1}. ${r.message}\n   📅 Waktu: ${r.targetTimeUtc.toLocaleString("id-ID", { timeZone: user.timezone })}`
            )
            .join("\n\n")
        );
      }

      default:
        return null;
    }
  }
}

export const messagePipeline = new MessagePipeline();
