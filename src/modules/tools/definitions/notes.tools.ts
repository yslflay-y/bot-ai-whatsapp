import { z } from "zod";
import { ToolDefinition } from "../tool.interface.js";
import { notesService } from "../../notes/notes.service.js";

export const createNoteTool: ToolDefinition<{ content: string; title?: string }> = {
  name: "create_note",
  description: "Menyimpan catatan atau ide baru pengguna ke database catatan.",
  permission: "USER_WRITE",
  schema: z.object({
    content: z.string().describe("Isi lengkap catatan yang ingin disimpan"),
    title: z.string().optional().describe("Judul singkat catatan (opsional)"),
  }),
  execute: async (params, context) => {
    const note = await notesService.createNote(context.user.id, params.content, params.title);
    return {
      success: true,
      message: "Catatan berhasil disimpan.",
      note: { id: note.id, title: note.title, content: note.content },
    };
  },
};

export const searchNotesTool: ToolDefinition<{ query: string }> = {
  name: "search_notes",
  description: "Mencari catatan pengguna berdasarkan kata kunci topik atau isi.",
  permission: "READ_ONLY",
  schema: z.object({
    query: z.string().describe("Kata kunci pencarian catatan"),
  }),
  execute: async (params, context) => {
    const notes = await notesService.searchNotes(context.user.id, params.query);
    return {
      count: notes.length,
      notes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content, date: n.createdAt })),
    };
  },
};

export const listNotesTool: ToolDefinition<{ limit?: number }> = {
  name: "list_notes",
  description: "Melihat daftar catatan terbaru yang dimiliki pengguna.",
  permission: "READ_ONLY",
  schema: z.object({
    limit: z.number().optional().describe("Jumlah catatan yang ingin ditampilkan (default: 5)"),
  }),
  execute: async (params, context) => {
    const limit = params.limit || 5;
    const notes = await notesService.listNotes(context.user.id, limit);
    return {
      count: notes.length,
      notes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content, date: n.createdAt })),
    };
  },
};

export const deleteNoteTool: ToolDefinition<{ noteId: string }> = {
  name: "delete_note",
  description: "Menghapus catatan berdasarkan ID catatan.",
  permission: "USER_WRITE",
  schema: z.object({
    noteId: z.string().describe("ID catatan yang ingin dihapus"),
  }),
  execute: async (params, context) => {
    const deleted = await notesService.deleteNote(context.user.id, params.noteId);
    return {
      success: deleted,
      message: deleted ? "Catatan berhasil dihapus." : "Catatan tidak ditemukan.",
    };
  },
};
