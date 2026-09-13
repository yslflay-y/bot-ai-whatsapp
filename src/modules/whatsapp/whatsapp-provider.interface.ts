import { InboundMessage } from "../messaging/message.types.js";

export type MessageHandler = (message: InboundMessage) => Promise<void>;

export interface WhatsAppProvider {
  readonly providerName: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(toJid: string, text: string, quotedMessageId?: string): Promise<string>;
  sendMedia(toJid: string, buffer: Buffer, mimeType: string, caption?: string): Promise<string>;
  onMessage(handler: MessageHandler): void;
  isConnected(): boolean;
}
