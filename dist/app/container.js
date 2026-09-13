import { registerAllCoreTools } from "../modules/tools/definitions/index.js";
import { initializeReminderWorker } from "../modules/reminders/reminder.worker.js";
import { remindersService } from "../modules/reminders/reminders.service.js";
import { baileysAdapter } from "../modules/whatsapp/baileys.adapter.js";
import { messagePipeline } from "../modules/messaging/message.pipeline.js";
import { disconnectDatabase } from "../infrastructure/database/prisma.js";
import { disconnectRedis } from "../infrastructure/redis/redis.client.js";
import { closeAllQueuesAndWorkers } from "../infrastructure/queue/queue.manager.js";
import { startHttpServer } from "./server.js";
import { logger } from "../infrastructure/logging/logger.js";
export class ApplicationContainer {
    httpServer = null;
    async start() {
        logger.info("Starting WhatsApp AI Assistant...");
        // 1. Register Core Tool Definitions
        registerAllCoreTools();
        // 2. Initialize BullMQ Workers
        initializeReminderWorker();
        // 3. Recover pending reminders from PostgreSQL into BullMQ
        try {
            await remindersService.recoverPendingReminders();
        }
        catch (err) {
            logger.error({ err }, "Could not recover pending reminders on startup");
        }
        // 4. Hook Baileys Adapter to Message Pipeline
        baileysAdapter.onMessage(async (msg) => {
            await messagePipeline.handleInbound(msg);
        });
        // 5. Start WhatsApp Connection
        await baileysAdapter.start();
        // 6. Start Observability HTTP Server
        this.httpServer = await startHttpServer();
        logger.info("WhatsApp AI Assistant initialization complete and running!");
    }
    async stop() {
        logger.info("Stopping WhatsApp AI Assistant gracefully...");
        // 1. Stop HTTP Server
        if (this.httpServer) {
            try {
                await this.httpServer.close();
                logger.info("HTTP Server stopped");
            }
            catch (err) {
                logger.warn({ err }, "Error stopping HTTP server");
            }
        }
        // 2. Stop WhatsApp Socket
        try {
            await baileysAdapter.stop();
            logger.info("WhatsApp adapter stopped");
        }
        catch (err) {
            logger.warn({ err }, "Error stopping WhatsApp adapter");
        }
        // 3. Stop BullMQ Workers & Queues
        await closeAllQueuesAndWorkers();
        // 4. Disconnect Redis
        await disconnectRedis();
        // 5. Disconnect Database
        await disconnectDatabase();
        logger.info("Graceful shutdown finished cleanly");
    }
}
export const container = new ApplicationContainer();
