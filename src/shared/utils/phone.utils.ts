/**
 * Utilities for normalizing phone numbers and WhatsApp JIDs.
 */

export interface NormalizedPhone {
  raw: string;
  e164: string; // e.g. "6281234567890"
  jid: string;  // e.g. "6281234567890@s.whatsapp.net"
  isGroup: boolean;
}

export function normalizePhoneNumber(input: string): NormalizedPhone {
  const trimmed = input.trim();
  const isGroup = trimmed.endsWith("@g.us");

  if (isGroup) {
    return {
      raw: trimmed,
      e164: trimmed.replace(/@g\.us$/, ""),
      jid: trimmed,
      isGroup: true,
    };
  }

  // Remove any @s.whatsapp.net or other jid suffixes
  let digits = trimmed.replace(/@.*$/, "").replace(/[^\d]/g, "");

  // Convert Indonesian local 08xx prefix to 628xx
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }

  const jid = `${digits}@s.whatsapp.net`;

  return {
    raw: trimmed,
    e164: digits,
    jid,
    isGroup: false,
  };
}

export function isSameUser(jid1: string, jid2: string): boolean {
  return normalizePhoneNumber(jid1).jid === normalizePhoneNumber(jid2).jid;
}
