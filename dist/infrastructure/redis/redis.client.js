import { Redis } from "ioredis";
import { config } from "../../app/config.js";
import { logger } from "../logging/logger.js";
let redisClient = null;
export function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis({
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            password: config.REDIS_PASSWORD || undefined,
            db: config.REDIS_DB,
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: true,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                logger.warn({ attempt: times, delay }, "Reconnecting to Redis...");
                return delay;
            },
        });
        redisClient.on("connect", () => {
            logger.info("Connected to Redis successfully");
        });
        redisClient.on("error", (err) => {
            logger.error({ err: err.message }, "Redis connection error");
        });
    }
    return redisClient;
}
export async function checkRedisHealth() {
    const client = getRedisClient();
    const start = Date.now();
    try {
        const pong = await client.ping();
        return {
            isHealthy: pong === "PONG",
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
export async function disconnectRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info("Disconnected from Redis");
    }
}
