import { prisma } from "../../infrastructure/database/prisma.js";
import { Note } from "@prisma/client";

export class NotesService {
  async createNote(userId: string, content: string, title?: string, tags: string[] = []): Promise<Note> {
    return prisma.note.create({
      data: {
        userId,
        title: title || null,
        content,
        tags,
      },
    });
  }

  async searchNotes(userId: string, query: string): Promise<Note[]> {
    return prisma.note.findMany({
      where: {
        userId,
        OR: [
          { content: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  async listNotes(userId: string, limit = 10): Promise<Note[]> {
    return prisma.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async updateNote(userId: string, noteId: string, content: string, title?: string): Promise<Note | null> {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (!existing) return null;

    return prisma.note.update({
      where: { id: noteId },
      data: {
        content,
        title: title !== undefined ? title : existing.title,
      },
    });
  }

  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (!existing) return false;

    await prisma.note.delete({
      where: { id: noteId },
    });
    return true;
  }
}

export const notesService = new NotesService();
