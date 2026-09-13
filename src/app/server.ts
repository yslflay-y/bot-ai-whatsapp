import Fastify, { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../infrastructure/database/prisma.js";
import { checkRedisHealth } from "../infrastructure/redis/redis.client.js";
import { whatsAppProviderHolder } from "../modules/whatsapp/whatsapp.holder.js";
import { metrics } from "./metrics.js";
import { logger } from "../infrastructure/logging/logger.js";
import { config } from "./config.js";

export function createServer(): FastifyInstance {
  const app = Fastify({
    logger: false, // use our root Pino logger instead
  });

  // Liveness probe
  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness probe checking PostgreSQL, Redis, and WhatsApp state
  app.get("/ready", async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const whatsapp = whatsAppProviderHolder.getProvider();
    const isWhatsAppReady = whatsapp ? whatsapp.isConnected() : false;

    const isReady = dbHealth.isHealthy && redisHealth.isHealthy;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? "ready" : "unhealthy",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: {
          healthy: dbHealth.isHealthy,
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error,
        },
        redis: {
          healthy: redisHealth.isHealthy,
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error,
        },
        whatsapp: {
          connected: isWhatsAppReady,
        },
      },
    });
  });

  // Metrics endpoint
  app.get("/metrics", async (_request, reply) => {
    return reply.status(200).send({
      metrics: metrics.getSnapshot(),
      process: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    });
  });

  return app;
}

export async function startHttpServer(): Promise<FastifyInstance> {
  const server = createServer();
  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    logger.info({ host: config.HOST, port: config.PORT }, "HTTP Server running");
    return server;
  } catch (err: unknown) {
    logger.error({ err }, "Failed to start HTTP server");
    throw err;
  }
}
