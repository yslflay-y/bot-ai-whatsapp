import { prisma } from "../../infrastructure/database/prisma.js";
export class MemoryService {
    async remember(userId, content, key, category = "GENERAL") {
        return prisma.memory.create({
            data: {
                userId,
                content,
                key: key || null,
                category,
            },
        });
    }
    async getActiveMemories(userId, limit = 20) {
        return prisma.memory.findMany({
            where: { userId, isActive: true },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }
    async searchMemories(userId, query) {
        return prisma.memory.findMany({
            where: {
                userId,
                isActive: true,
                content: { contains: query, mode: "insensitive" },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
    }
    async forgetMemory(userId, memoryId) {
        const existing = await prisma.memory.findFirst({
            where: { id: memoryId, userId },
        });
        if (!existing)
            return false;
        await prisma.memory.update({
            where: { id: memoryId },
            data: { isActive: false },
        });
        return true;
    }
}
export const memoryService = new MemoryService();
