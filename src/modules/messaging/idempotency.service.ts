import { getRedisClient } from "../../infrastructure/redis/redis.client.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { config } from "../../app/config.js";

export class IdempotencyService {
  private keyPrefix = "msg:dedup:";
  private rateLimitPrefix = "ratelimit:";

  /**
   * Attempts to acquire an idempotent lock for a message ID.
   * Returns true if this is the first time seeing this message (acquired).
   * Returns false if this message was already processed or is currently being processed.
   */
  async acquireMessageLock(messageId: string, ttlSeconds = 3600): Promise<boolean> {
    if (!messageId) return true; // Cannot deduplicate without an ID

    try {
      const redis = getRedisClient();
      const key = `${this.keyPrefix}${messageId}`;
      // SET key value NX EX seconds: returns "OK" if set, null if already exists
      const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
      const isNew = result === "OK";

      if (!isNew) {
        logger.warn({ messageId }, "Duplicate WhatsApp event detected and dropped");
      }

      return isNew;
    } catch (err: unknown) {
      logger.error({ messageId, err }, "Redis error checking message idempotency");
      // Graceful degradation: in case of Redis failure, allow message to proceed
      return true;
    }
  }

  /**
   * Checks rate limiting for a given user identifier.
   */
  async checkRateLimit(
    userId: string,
    limit = config.RATE_LIMIT_MAX_PER_MINUTE
  ): Promise<{ allowed: boolean; count: number }> {
    try {
      const redis = getRedisClient();
      const currentMinute = Math.floor(Date.now() / 60000);
      const key = `${this.rateLimitPrefix}${userId}:${currentMinute}`;

      const count = await redis.incr(key);
      if (count === 1) {
        // Set expiry for 65 seconds
        await redis.expire(key, 65);
      }

      return {
        allowed: count <= limit,
        count,
      };
    } catch (err: unknown) {
      logger.error({ userId, err }, "Error checking rate limit in Redis");
      return { allowed: true, count: 1 };
    }
  }
}

export const idempotencyService = new IdempotencyService();
