import { z } from "zod";
import { fetchSafeWebContent } from "../ssrf.validator.js";
export const summarizeUrlTool = {
    name: "summarize_url",
    description: "Membaca dan mengambil konten artikel/halaman web dari tautan URL publik secara aman (dengan proteksi SSRF).",
    permission: "READ_ONLY",
    schema: z.object({
        url: z.string().url().describe("URL halaman web publik yang ingin diringkas (contoh: https://example.com/berita)"),
    }),
    execute: async (params) => {
        const webContent = await fetchSafeWebContent(params.url);
        return {
            title: webContent.title,
            url: webContent.url,
            // Wrap content safely so AI models treat it as data, not instruction overrides
            content: `[KONTEN DARI ${webContent.url}]:\n${webContent.text}`,
        };
    },
};
