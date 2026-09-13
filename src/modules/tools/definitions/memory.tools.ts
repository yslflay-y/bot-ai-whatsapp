import { z } from "zod";
import { ToolDefinition } from "../tool.interface.js";
import { memoryService } from "../../memory/memory.service.js";

export const rememberTool: ToolDefinition<{ fact: string; key?: string }> = {
  name: "remember",
  description: "Menyimpan preferensi, instruksi jangka panjang, atau fakta penting tentang pengguna ke memori permanen.",
  permission: "USER_WRITE",
  schema: z.object({
    fact: z.string().describe("Fakta atau preferensi yang harus diingat secara permanen (contoh: 'Pengguna menyukai jawaban singkat dan to the point')"),
    key: z.string().optional().describe("Topik ringkas dari fakta ini (contoh: 'gaya_bahasa', 'spek_server')"),
  }),
  execute: async (params, context) => {
    const memory = await memoryService.remember(context.user.id, params.fact, params.key);
    return {
      success: true,
      message: "Fakta berhasil disimpan ke memori permanen.",
      memoryId: memory.id,
    };
  },
};

export const searchMemoriesTool: ToolDefinition<{ query: string }> = {
  name: "search_memories",
  description: "Mencari fakta atau memori tersimpan tentang pengguna berdasarkan kata kunci.",
  permission: "READ_ONLY",
  schema: z.object({
    query: z.string().describe("Kata kunci pencarian memori"),
  }),
  execute: async (params, context) => {
    const memories = await memoryService.searchMemories(context.user.id, params.query);
    return {
      count: memories.length,
      memories: memories.map((m) => ({ id: m.id, content: m.content, key: m.key })),
    };
  },
};

export const forgetMemoryTool: ToolDefinition<{ memoryId: string }> = {
  name: "forget_memory",
  description: "Menonaktifkan atau melupakan memori tertentu berdasarkan ID memori.",
  permission: "USER_WRITE",
  schema: z.object({
    memoryId: z.string().describe("ID memori yang ingin dilupakan"),
  }),
  execute: async (params, context) => {
    const success = await memoryService.forgetMemory(context.user.id, params.memoryId);
    return {
      success,
      message: success ? "Memori berhasil dilupakan." : "Memori tidak ditemukan.",
    };
  },
};
