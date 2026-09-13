import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, { DisconnectReason, useMultiFileAuthState, downloadMediaMessage, } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { config } from "../../app/config.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { whatsAppProviderHolder } from "./whatsapp.holder.js";
export class BaileysAdapter {
    providerName = "baileys";
    sock = null;
    messageHandler = null;
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    isStopping = false;
    constructor() {
        whatsAppProviderHolder.setProvider(this);
    }
    isConnected() {
        return this.connected;
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async start() {
        this.isStopping = false;
        const authDir = path.resolve(config.AUTH_STATE_PATH);
        await fs.mkdir(authDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // handled manually via event
            logger: logger.child({ module: "baileys" }),
            browser: ["Ubuntu VPS Assistant", "Chrome", "20.0.04"],
            syncFullHistory: false,
        });
        this.sock.ev.on("creds.update", saveCreds);
        this.sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                logger.info("WhatsApp QR code received. Scan QR code below to pair:");
                qrcode.generate(qr, { small: true });
            }
            if (connection === "close") {
                this.connected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = !this.isStopping &&
                    statusCode !== DisconnectReason.loggedOut &&
                    this.reconnectAttempts < this.maxReconnectAttempts;
                logger.warn({ statusCode, shouldReconnect, attempt: this.reconnectAttempts }, "WhatsApp connection closed");
                if (shouldReconnect) {
                    this.reconnectAttempts++;
                    const delay = Math.min(this.reconnectAttempts * 2000, 30000);
                    logger.info({ delayMs: delay }, "Waiting to reconnect WhatsApp socket...");
                    setTimeout(() => this.start(), delay);
                }
                else if (statusCode === DisconnectReason.loggedOut) {
                    logger.error("Device logged out from WhatsApp. Clear auth directory and re-scan QR code.");
                }
            }
            else if (connection === "open") {
                this.connected = true;
                this.reconnectAttempts = 0;
                logger.info("WhatsApp socket connected successfully!");
            }
        });
        this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== "notify")
                return;
            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe)
                    continue; // Skip messages sent by bot itself
                try {
                    const inbound = await this.parseBaileysMessage(msg);
                    if (inbound && this.messageHandler) {
                        await this.messageHandler(inbound);
                    }
                }
                catch (err) {
                    logger.error({ msgId: msg.key.id, err }, "Error processing incoming WhatsApp message");
                }
            }
        });
    }
    async stop() {
        this.isStopping = true;
        this.connected = false;
        if (this.sock) {
            try {
                this.sock.end(undefined);
            }
            catch (err) {
                logger.warn({ err }, "Error ending Baileys socket");
            }
            this.sock = null;
        }
    }
    async sendMessage(toJid, text, quotedMessageId) {
        if (!this.sock || !this.connected) {
            logger.warn({ toJid }, "Cannot send WhatsApp message: socket not connected");
            return "";
        }
        const options = {};
        if (quotedMessageId) {
            // Baileys quote message structure can be referenced if needed
        }
        const sent = await this.sock.sendMessage(toJid, { text }, options);
        return sent?.key?.id || "";
    }
    async sendMedia(toJid, buffer, mimeType, caption) {
        if (!this.sock || !this.connected) {
            logger.warn({ toJid }, "Cannot send WhatsApp media: socket not connected");
            return "";
        }
        let payload;
        if (mimeType.startsWith("image/")) {
            payload = { image: buffer, caption };
        }
        else if (mimeType.startsWith("audio/")) {
            payload = { audio: buffer, mimetype: mimeType, ptt: true };
        }
        else {
            payload = { document: buffer, mimetype: mimeType, fileName: "file" };
        }
        const sent = await this.sock.sendMessage(toJid, payload);
        return sent?.key?.id || "";
    }
    async parseBaileysMessage(msg) {
        const rawMsg = msg.message;
        if (!rawMsg || !msg.key)
            return null;
        const fromJid = msg.key.remoteJid || "";
        const id = msg.key.id || "";
        const senderName = msg.pushName || undefined;
        const timestamp = msg.messageTimestamp
            ? new Date(Number(msg.messageTimestamp) * 1000)
            : new Date();
        let body = "";
        let type = "text";
        let mediaBuffer = undefined;
        let mediaMimeType = undefined;
        if (rawMsg.conversation) {
            body = rawMsg.conversation;
        }
        else if (rawMsg.extendedTextMessage?.text) {
            body = rawMsg.extendedTextMessage.text;
        }
        else if (rawMsg.imageMessage) {
            type = "image";
            body = rawMsg.imageMessage.caption || "";
            mediaMimeType = rawMsg.imageMessage.mimetype || "image/jpeg";
            try {
                mediaBuffer = (await downloadMediaMessage(msg, "buffer", {}));
            }
            catch (e) {
                logger.error({ id, e }, "Failed to download WhatsApp image buffer");
            }
        }
        else if (rawMsg.audioMessage) {
            type = "voice";
            body = "";
            mediaMimeType = rawMsg.audioMessage.mimetype || "audio/ogg";
            try {
                mediaBuffer = (await downloadMediaMessage(msg, "buffer", {}));
            }
            catch (e) {
                logger.error({ id, e }, "Failed to download WhatsApp voice note buffer");
            }
        }
        else if (rawMsg.documentMessage) {
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
