import dns from "node:dns/promises";
import * as cheerio from "cheerio";
import { ValidationError } from "../../shared/errors/app-error.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { config } from "../../app/config.js";
/**
 * Checks whether an IPv4 address belongs to a reserved or private range.
 */
export function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return true; // Malformed IP treated as dangerous
    }
    const [a, b] = parts;
    // 0.0.0.0/8
    if (a === 0)
        return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127)
        return true;
    // 10.0.0.0/8 (Private)
    if (a === 10)
        return true;
    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168)
        return true;
    // 169.254.0.0/16 (Link-Local & Cloud Metadata)
    if (a === 169 && b === 254)
        return true;
    // Broadcast
    if (a === 255)
        return true;
    return false;
}
/**
 * Checks whether an IPv6 address is loopback, unique local, or link-local.
 */
export function isPrivateIPv6(ip) {
    const clean = ip.toLowerCase();
    if (clean === "::1" || clean === "::")
        return true;
    if (clean.startsWith("fc") || clean.startsWith("fd"))
        return true; // Unique local
    if (clean.startsWith("fe80:"))
        return true; // Link-local
    if (clean.startsWith("::ffff:127.") || clean.startsWith("::ffff:10.") || clean.startsWith("::ffff:192.168.")) {
        return true; // IPv4-mapped private
    }
    return false;
}
/**
 * Validates a target URL against SSRF vulnerabilities.
 */
export async function validateSafeUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        throw new ValidationError("URL yang dimasukkan tidak valid.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ValidationError("Hanya protokol HTTP dan HTTPS yang diizinkan.");
    }
    const hostname = parsed.hostname;
    // Check obvious hostnames
    if (hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname === "127.0.0.1" ||
        hostname === "::1") {
        throw new ValidationError("Akses ke host internal/lokal dilarang.");
    }
    // Resolve DNS to verify IP addresses (mitigates DNS rebinding)
    try {
        const lookup = await dns.lookup(hostname, { all: true });
        for (const record of lookup) {
            if (record.family === 4 && isPrivateIPv4(record.address)) {
                throw new ValidationError("URL mengarah ke alamat IP private/internal yang diblokir.");
            }
            if (record.family === 6 && isPrivateIPv6(record.address)) {
                throw new ValidationError("URL mengarah ke alamat IP private/internal yang diblokir.");
            }
        }
    }
    catch (err) {
        if (err instanceof ValidationError)
            throw err;
        throw new ValidationError("Gagal menyelesaikan nama domain target (DNS lookup failed).");
    }
    return parsed;
}
/**
 * Safely fetches a web page and extracts readable text for AI consumption.
 */
export async function fetchSafeWebContent(targetUrl, maxBytes = 2 * 1024 * 1024 // 2MB
) {
    const url = await validateSafeUrl(targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.SSRF_TIMEOUT_MS);
    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsAppAssistant/1.0",
                Accept: "text/html,application/xhtml+xml,text/plain",
            },
            redirect: "follow",
        });
        if (!response.ok) {
            throw new ValidationError(`Halaman web mengembalikan error status HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            throw new ValidationError("Format konten tidak didukung (hanya halaman web teks yang didukung).");
        }
        const textBuffer = await response.text();
        if (textBuffer.length > maxBytes) {
            throw new ValidationError("Ukuran halaman web melebihi batas maksimum yang diizinkan (2MB).");
        }
        const $ = cheerio.load(textBuffer);
        // Strip script tags, styles, iframes, adverts
        $("script, style, iframe, noscript, svg, nav, footer, header").remove();
        const title = $("title").first().text().trim() || "Web Page";
        const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 10000); // 10k chars max
        return {
            title,
            text: bodyText,
            url: url.toString(),
        };
    }
    catch (err) {
        if (err instanceof ValidationError)
            throw err;
        logger.error({ targetUrl, err }, "Failed to safely fetch web content");
        throw new ValidationError("Tidak dapat mengakses atau membaca tautan web yang diberikan.");
    }
    finally {
        clearTimeout(timeout);
    }
}
