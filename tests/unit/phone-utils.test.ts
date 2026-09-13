import { describe, it, expect } from "vitest";
import { normalizePhoneNumber } from "../../src/shared/utils/phone.utils.js";

describe("Phone Utilities", () => {
  it("normalizes Indonesian 08xx number to standard E.164 and WhatsApp JID", () => {
    const result = normalizePhoneNumber("081234567890");
    expect(result.e164).toBe("6281234567890");
    expect(result.jid).toBe("6281234567890@s.whatsapp.net");
    expect(result.isGroup).toBe(false);
  });

  it("normalizes international formatted numbers (+62 812-3456-7890)", () => {
    const result = normalizePhoneNumber("+62 812-3456-7890");
    expect(result.e164).toBe("6281234567890");
    expect(result.jid).toBe("6281234567890@s.whatsapp.net");
  });

  it("handles JID input directly", () => {
    const result = normalizePhoneNumber("6281234567890@s.whatsapp.net");
    expect(result.e164).toBe("6281234567890");
    expect(result.jid).toBe("6281234567890@s.whatsapp.net");
  });

  it("detects WhatsApp group JIDs correctly", () => {
    const result = normalizePhoneNumber("120363024823948293@g.us");
    expect(result.isGroup).toBe(true);
    expect(result.jid).toBe("120363024823948293@g.us");
  });
});
