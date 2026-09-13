import { prisma } from "../../infrastructure/database/prisma.js";
export class NotesService {
    async createNote(userId, content, title, tags = []) {
        return prisma.note.create({
            data: {
                userId,
                title: title || null,
                content,
                tags,
            },
        });
    }
    async searchNotes(userId, query) {
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
    async listNotes(userId, limit = 10) {
        return prisma.note.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }
    async updateNote(userId, noteId, content, title) {
        const existing = await prisma.note.findFirst({
            where: { id: noteId, userId },
        });
        if (!existing)
            return null;
        return prisma.note.update({
            where: { id: noteId },
            data: {
                content,
                title: title !== undefined ? title : existing.title,
            },
        });
    }
    async deleteNote(userId, noteId) {
        const existing = await prisma.note.findFirst({
            where: { id: noteId, userId },
        });
        if (!existing)
            return false;
        await prisma.note.delete({
            where: { id: noteId },
        });
        return true;
    }
}
export const notesService = new NotesService();
