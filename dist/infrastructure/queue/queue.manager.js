import { Queue, Worker } from "bullmq";
import { config } from "../../app/config.js";
import { logger } from "../logging/logger.js";
const redisConnection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    maxRetriesPerRequest: null,
};
const defaultQueueOptions = {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: {
            age: 24 * 3600, // keep for 24 hours
            count: 1000,
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // keep failed for 7 days
        },
    },
};
export const QUEUE_NAMES = {
    REMINDERS: "whatsapp-reminders",
    TRANSCRIPTION: "whatsapp-transcription",
    CLEANUP: "whatsapp-cleanup",
};
const queues = new Map();
const workers = new Map();
export function getQueue(name) {
    let queue = queues.get(name);
    if (!queue) {
        queue = new Queue(name, defaultQueueOptions);
        queues.set(name, queue);
        logger.info({ queueName: name }, "Initialized BullMQ queue");
    }
    return queue;
}
export function registerWorker(name, processor, options) {
    if (workers.has(name)) {
        return workers.get(name);
    }
    const worker = new Worker(name, processor, {
        connection: redisConnection,
        concurrency: 5,
        ...options,
    });
    worker.on("completed", (job) => {
        logger.debug({ queue: name, jobId: job.id }, "Job completed successfully");
    });
    worker.on("failed", (job, err) => {
        logger.error({ queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, "Job failed execution");
    });
    workers.set(name, worker);
    logger.info({ queueName: name }, "Registered BullMQ worker");
    return worker;
}
export async function closeAllQueuesAndWorkers() {
    logger.info("Closing all BullMQ workers and queues...");
    for (const [name, worker] of workers.entries()) {
        try {
            await worker.close();
            logger.info({ worker: name }, "Worker closed");
        }
        catch (err) {
            logger.error({ worker: name, err }, "Error closing worker");
        }
    }
    workers.clear();
    for (const [name, queue] of queues.entries()) {
        try {
            await queue.close();
            logger.info({ queue: name }, "Queue closed");
        }
        catch (err) {
            logger.error({ queue: name, err }, "Error closing queue");
        }
    }
    queues.clear();
}
