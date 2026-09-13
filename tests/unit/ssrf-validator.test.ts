import { describe, it, expect } from "vitest";
import { isPrivateIPv4, isPrivateIPv6, validateSafeUrl } from "../../src/modules/tools/ssrf.validator.js";
import { ValidationError } from "../../src/shared/errors/app-error.js";

describe("SSRF Validator", () => {
  it("correctly flags private IPv4 ranges", () => {
    // Loopback
    expect(isPrivateIPv4("127.0.0.1")).toBe(true);
    expect(isPrivateIPv4("127.10.0.5")).toBe(true);
    // Private 10.x.x.x
    expect(isPrivateIPv4("10.0.0.1")).toBe(true);
    // Private 172.16-31.x.x
    expect(isPrivateIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateIPv4("172.31.255.255")).toBe(true);
    expect(isPrivateIPv4("172.32.0.1")).toBe(false); // Public
    // Private 192.168.x.x
    expect(isPrivateIPv4("192.168.1.1")).toBe(true);
    // Cloud metadata link-local
    expect(isPrivateIPv4("169.254.169.254")).toBe(true);
    // Public IPs
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateIPv4("1.1.1.1")).toBe(false);
  });

  it("correctly flags private IPv6 addresses", () => {
    expect(isPrivateIPv6("::1")).toBe(true);
    expect(isPrivateIPv6("fe80::1")).toBe(true);
    expect(isPrivateIPv6("fc00::1")).toBe(true);
    expect(isPrivateIPv6("2607:f8b0:4005:805::200e")).toBe(false);
  });

  it("blocks non-HTTP protocols (e.g. file:, ftp:)", async () => {
    await expect(validateSafeUrl("file:///etc/passwd")).rejects.toThrow(ValidationError);
    await expect(validateSafeUrl("ftp://ftp.example.com/file")).rejects.toThrow(ValidationError);
    await expect(validateSafeUrl("gopher://example.com")).rejects.toThrow(ValidationError);
  });

  it("blocks explicit localhost addresses", async () => {
    await expect(validateSafeUrl("http://localhost:3000")).rejects.toThrow(ValidationError);
    await expect(validateSafeUrl("http://127.0.0.1:8080/secret")).rejects.toThrow(ValidationError);
  });
});
