import { container } from "./app/container.js";
import { logger } from "./infrastructure/logging/logger.js";
async function bootstrap() {
    try {
        await container.start();
    }
    catch (err) {
        logger.fatal({ err }, "Fatal error during application startup");
        process.exit(1);
    }
    const shutdown = async (signal) => {
        logger.info({ signal }, "Received termination signal, shutting down...");
        try {
            await container.stop();
            process.exit(0);
        }
        catch (err) {
            logger.error({ err }, "Error during shutdown sequence");
            process.exit(1);
        }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("unhandledRejection", (reason) => {
        logger.error({ reason }, "Unhandled promise rejection detected");
    });
    process.on("uncaughtException", (error) => {
        logger.fatal({ error }, "Uncaught exception detected");
        process.exit(1);
    });
}
bootstrap();
