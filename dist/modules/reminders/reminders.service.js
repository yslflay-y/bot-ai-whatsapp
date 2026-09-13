import { CronExpressionParser } from "cron-parser";
import { ReminderStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import { getQueue, QUEUE_NAMES } from "../../infrastructure/queue/queue.manager.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { ValidationError } from "../../shared/errors/app-error.js";
export class RemindersService {
    /**
     * Creates and schedules a new reminder in PostgreSQL and BullMQ.
     */
    async createReminder(params) {
        let targetTimeUtc = params.targetTimeUtc;
        if (params.isRecurring && params.cronExpression) {
            try {
                const interval = CronExpressionParser.parse(params.cronExpression);
                targetTimeUtc = interval.next().toDate();
            }
            catch {
                throw new ValidationError("Format cron expression pengingat berulang tidak valid.");
            }
        }
        if (!targetTimeUtc || isNaN(targetTimeUtc.getTime())) {
            throw new ValidationError("Waktu pengingat harus valid dan dapat ditentukan.");
        }
        // Save reminder to PostgreSQL
        const reminder = await prisma.reminder.create({
            data: {
                userId: params.userId,
                message: params.message,
                targetTimeUtc,
                cronExpression: params.cronExpression || null,
                isRecurring: params.isRecurring ?? false,
                status: ReminderStatus.SCHEDULED,
            },
        });
        // Schedule into BullMQ with delay
        await this.scheduleJobInQueue(reminder);
        return reminder;
    }
    /**
     * Schedules a reminder job in BullMQ with calculated delay.
     */
    async scheduleJobInQueue(reminder) {
        const delay = Math.max(0, reminder.targetTimeUtc.getTime() - Date.now());
        const queue = getQueue(QUEUE_NAMES.REMINDERS);
        await queue.add("send-reminder", { reminderId: reminder.id, userId: reminder.userId }, {
            jobId: `reminder:${reminder.id}`,
            delay,
            removeOnComplete: true,
        });
        logger.info({ reminderId: reminder.id, delayMs: delay, runAt: reminder.targetTimeUtc }, "Scheduled reminder in BullMQ");
    }
    /**
     * Lists active and upcoming reminders for a user.
     */
    async listReminders(userId) {
        return prisma.reminder.findMany({
            where: {
                userId,
                status: ReminderStatus.SCHEDULED,
            },
            orderBy: { targetTimeUtc: "asc" },
        });
    }
    /**
     * Cancels an active reminder.
     */
    async cancelReminder(userId, reminderId) {
        const reminder = await prisma.reminder.findFirst({
            where: { id: reminderId, userId, status: ReminderStatus.SCHEDULED },
        });
        if (!reminder)
            return false;
        await prisma.reminder.update({
            where: { id: reminderId },
            data: { status: ReminderStatus.CANCELLED },
        });
        // Remove job from BullMQ
        try {
            const queue = getQueue(QUEUE_NAMES.REMINDERS);
            const job = await queue.getJob(`reminder:${reminderId}`);
            if (job) {
                await job.remove();
            }
        }
        catch (err) {
            logger.warn({ reminderId, err }, "Failed to remove job from BullMQ during cancel");
        }
        return true;
    }
    /**
     * Startup recovery: re-registers all active pending reminders in BullMQ to survive restarts.
     */
    async recoverPendingReminders() {
        logger.info("Checking for pending reminders to recover after restart...");
        const pendingReminders = await prisma.reminder.findMany({
            where: {
                status: ReminderStatus.SCHEDULED,
                targetTimeUtc: { gte: new Date() },
            },
        });
        for (const reminder of pendingReminders) {
            try {
                await this.scheduleJobInQueue(reminder);
            }
            catch (err) {
                logger.error({ reminderId: reminder.id, err }, "Failed to recover reminder job");
            }
        }
        logger.info({ count: pendingReminders.length }, "Recovered pending reminders into BullMQ");
        return pendingReminders.length;
    }
}
export const remindersService = new RemindersService();
