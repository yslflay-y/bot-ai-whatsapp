import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  proto,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { WhatsAppProvider, MessageHandler } from "./whatsapp-provider.interface.js";
import { InboundMessage, MessageType } from "../messaging/message.types.js";
import { config } from "../../app/config.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { whatsAppProviderHolder } from "./whatsapp.holder.js";

export class BaileysAdapter implements WhatsAppProvider {
  public readonly providerName = "baileys";
  private sock: any = null;
  private messageHandler: MessageHandler | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isStopping = false;

  constructor() {
    whatsAppProviderHolder.setProvider(this);
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    this.isStopping = false;
    const authDir = path.resolve(config.AUTH_STATE_PATH);
    await fs.mkdir(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // handled manually via event
      logger: logger.child({ module: "baileys" }) as any,
      browser: ["Ubuntu VPS Assistant", "Chrome", "20.0.04"],
      syncFullHistory: false,
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info("WhatsApp QR code received. Scan QR code below to pair:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "close") {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect =
          !this.isStopping &&
          statusCode !== DisconnectReason.loggedOut &&
          this.reconnectAttempts < this.maxReconnectAttempts;

        logger.warn(
          { statusCode, shouldReconnect, attempt: this.reconnectAttempts },
          "WhatsApp connection closed"
        );

        if (shouldReconnect) {
          this.reconnectAttempts++;
          const delay = Math.min(this.reconnectAttempts * 2000, 30000);
          logger.info({ delayMs: delay }, "Waiting to reconnect WhatsApp socket...");
          setTimeout(() => this.start(), delay);
        } else if (statusCode === DisconnectReason.loggedOut) {
          logger.error("Device logged out from WhatsApp. Clear auth directory and re-scan QR code.");
        }
      } else if (connection === "open") {
        this.connected = true;
        this.reconnectAttempts = 0;
        logger.info("WhatsApp socket connected successfully!");
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue; // Skip messages sent by bot itself

        try {
          const inbound = await this.parseBaileysMessage(msg);
          if (inbound && this.messageHandler) {
            await this.messageHandler(inbound);
          }
        } catch (err: unknown) {
          logger.error({ msgId: msg.key.id, err }, "Error processing incoming WhatsApp message");
        }
      }
    });
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    this.connected = false;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (err: unknown) {
        logger.warn({ err }, "Error ending Baileys socket");
      }
      this.sock = null;
    }
  }

  async sendMessage(toJid: string, text: string, quotedMessageId?: string): Promise<string> {
    if (!this.sock || !this.connected) {
      logger.warn({ toJid }, "Cannot send WhatsApp message: socket not connected");
      return "";
    }

    const options: any = {};
    if (quotedMessageId) {
      // Baileys quote message structure can be referenced if needed
    }

    const sent = await this.sock.sendMessage(toJid, { text }, options);
    return sent?.key?.id || "";
  }

  async sendMedia(
    toJid: string,
    buffer: Buffer,
    mimeType: string,
    caption?: string
  ): Promise<string> {
    if (!this.sock || !this.connected) {
      logger.warn({ toJid }, "Cannot send WhatsApp media: socket not connected");
      return "";
    }

    let payload: any;
    if (mimeType.startsWith("image/")) {
      payload = { image: buffer, caption };
    } else if (mimeType.startsWith("audio/")) {
      payload = { audio: buffer, mimetype: mimeType, ptt: true };
    } else {
      payload = { document: buffer, mimetype: mimeType, fileName: "file" };
    }

    const sent = await this.sock.sendMessage(toJid, payload);
    return sent?.key?.id || "";
  }

  private async parseBaileysMessage(msg: proto.IWebMessageInfo): Promise<InboundMessage | null> {
    const rawMsg = msg.message;
    if (!rawMsg || !msg.key) return null;

    const fromJid = msg.key.remoteJid || "";
    const id = msg.key.id || "";
    const senderName = msg.pushName || undefined;
    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000)
      : new Date();

    let body = "";
    let type: MessageType = "text";
    let mediaBuffer: Buffer | undefined = undefined;
    let mediaMimeType: string | undefined = undefined;

    if (rawMsg.conversation) {
      body = rawMsg.conversation;
    } else if (rawMsg.extendedTextMessage?.text) {
      body = rawMsg.extendedTextMessage.text;
    } else if (rawMsg.imageMessage) {
      type = "image";
      body = rawMsg.imageMessage.caption || "";
      mediaMimeType = rawMsg.imageMessage.mimetype || "image/jpeg";
      try {
        mediaBuffer = (await downloadMediaMessage(msg as any, "buffer", {})) as Buffer;
      } catch (e) {
        logger.error({ id, e }, "Failed to download WhatsApp image buffer");
      }
    } else if (rawMsg.audioMessage) {
      type = "voice";
      body = "";
      mediaMimeType = rawMsg.audioMessage.mimetype || "audio/ogg";
      try {
        mediaBuffer = (await downloadMediaMessage(msg as any, "buffer", {})) as Buffer;
      } catch (e) {
        logger.error({ id, e }, "Failed to download WhatsApp voice note buffer");
      }
    } else if (rawMsg.documentMessage) {
      type = "document";
      body = rawMsg.documentMessage.caption || "";
      mediaMimeType = rawMsg.documentMessage.mimetype || "application/octet-stream";
    }

    return {
      id,
      fromJid,
      senderName,
      body,
      type,
      mediaBuffer,
      mediaMimeType,
      timestamp,
      raw: msg,
    };
  }
}

export const baileysAdapter = new BaileysAdapter();
