import { PrismaClient } from "@prisma/client";
export const prisma = global.prismaGlobal ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "info", "warn", "error"]
            : ["warn", "error"],
    });
if (process.env.NODE_ENV !== "production") {
    global.prismaGlobal = prisma;
}
/**
 * Health check to verify PostgreSQL connectivity and latency.
 */
export async function checkDatabaseHealth() {
    const start = Date.now();
    try {
        await prisma.$queryRaw `SELECT 1`;
        return {
            isHealthy: true,
            latencyMs: Date.now() - start,
        };
    }
    catch (err) {
        return {
            isHealthy: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * Gracefully disconnect Prisma client on application shutdown.
 */
export async function disconnectDatabase() {
    await prisma.$disconnect();
}
