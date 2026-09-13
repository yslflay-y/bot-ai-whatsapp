import { prisma } from "../../infrastructure/database/prisma.js";
import { Memory } from "@prisma/client";

export class MemoryService {
  async remember(userId: string, content: string, key?: string, category = "GENERAL"): Promise<Memory> {
    return prisma.memory.create({
      data: {
        userId,
        content,
        key: key || null,
        category,
      },
    });
  }

  async getActiveMemories(userId: string, limit = 20): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async searchMemories(userId: string, query: string): Promise<Memory[]> {
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

  async forgetMemory(userId: string, memoryId: string): Promise<boolean> {
    const existing = await prisma.memory.findFirst({
      where: { id: memoryId, userId },
    });
    if (!existing) return false;

    await prisma.memory.update({
      where: { id: memoryId },
      data: { isActive: false },
    });
    return true;
  }
}

export const memoryService = new MemoryService();
