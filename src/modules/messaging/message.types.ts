export type MessageType = "text" | "voice" | "image" | "document";

export interface InboundMessage {
  id: string; // WhatsApp external message id
  fromJid: string; // sender JID
  senderName?: string;
  body: string;
  type: MessageType;
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
  mediaFilename?: string;
  timestamp: Date;
  raw?: unknown;
}

export interface OutboundMessage {
  toJid: string;
  text: string;
  quotedMessageId?: string;
}
