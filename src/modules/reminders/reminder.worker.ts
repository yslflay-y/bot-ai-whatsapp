import { CronExpressionParser } from "cron-parser";
import { ReminderStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import { registerWorker, QUEUE_NAMES, getQueue } from "../../infrastructure/queue/queue.manager.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { whatsAppProviderHolder } from "../whatsapp/whatsapp.holder.js";

interface ReminderJobPayload {
  reminderId: string;
  userId: string;
}

export function initializeReminderWorker(): void {
  registerWorker<ReminderJobPayload, void>(
    QUEUE_NAMES.REMINDERS,
    async (job) => {
      const { reminderId } = job.data;
      logger.info({ reminderId, jobId: job.id }, "Processing reminder delivery job");

      const reminder = await prisma.reminder.findUnique({
        where: { id: reminderId },
        include: { user: true },
      });

      if (!reminder) {
        logger.warn({ reminderId }, "Reminder record not found in database, skipping");
        return;
      }

      if (reminder.status !== ReminderStatus.SCHEDULED) {
        logger.info({ reminderId, status: reminder.status }, "Reminder is no longer scheduled, skipping");
        return;
      }

      const whatsapp = whatsAppProviderHolder.getProvider();
      if (whatsapp) {
        const text = `⏰ *PENGINGAT:*\n\n${reminder.message}`;
        await whatsapp.sendMessage(reminder.user.jid, text);
        logger.info({ reminderId, recipient: reminder.user.jid }, "Reminder sent successfully via WhatsApp");
      } else {
        logger.warn({ reminderId }, "WhatsApp provider not ready to dispatch reminder message");
      }

      // If recurring, calculate next trigger time and re-queue
      if (reminder.isRecurring && reminder.cronExpression) {
        try {
          const interval = CronExpressionParser.parse(reminder.cronExpression);
          const nextTarget = interval.next().toDate();

          await prisma.reminder.update({
            where: { id: reminderId },
            data: {
              targetTimeUtc: nextTarget,
              lastTriggeredAt: new Date(),
            },
          });

          const delay = Math.max(0, nextTarget.getTime() - Date.now());
          const queue = getQueue(QUEUE_NAMES.REMINDERS);
          await queue.add(
            "send-reminder",
            { reminderId: reminder.id, userId: reminder.userId },
            {
              jobId: `reminder:${reminder.id}:${nextTarget.getTime()}`,
              delay,
              removeOnComplete: true,
            }
          );

          logger.info({ reminderId, nextTarget }, "Rescheduled recurring reminder");
          return;
        } catch (cronErr: unknown) {
          logger.error({ reminderId, cronErr }, "Failed to reschedule recurring reminder");
        }
      }

      // Mark one-time reminder as COMPLETED
      await prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.COMPLETED,
          lastTriggeredAt: new Date(),
        },
      });
    },
    { concurrency: 5 }
  );

  logger.info("Initialized Reminder BullMQ worker");
}
