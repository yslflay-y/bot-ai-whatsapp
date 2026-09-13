import { z } from "zod";
import { ToolDefinition } from "../tool.interface.js";
import { remindersService } from "../../reminders/reminders.service.js";

export const createReminderTool: ToolDefinition<{
  message: string;
  targetTimeIso: string;
  cronExpression?: string;
  isRecurring?: boolean;
}> = {
  name: "create_reminder",
  description: "Membuat pengingat (reminder) baru satu kali atau berulang (cron) untuk pengguna.",
  permission: "USER_WRITE",
  schema: z.object({
    message: z.string().describe("Pesan atau tugas yang perlu diingatkan (contoh: 'Backup server VPS')"),
    targetTimeIso: z.string().describe("Waktu pelaksanaan dalam format ISO 8601 UTC (contoh: '2026-09-14T01:00:00.000Z')"),
    cronExpression: z.string().optional().describe("Cron expression jika pengingat berulang (contoh: '0 9 * * 1' untuk setiap Senin jam 9)"),
    isRecurring: z.boolean().optional().describe("True jika pengingat ini berulang secara berkala"),
  }),
  execute: async (params, context) => {
    const targetDate = new Date(params.targetTimeIso);
    const reminder = await remindersService.createReminder({
      userId: context.user.id,
      message: params.message,
      targetTimeUtc: targetDate,
      cronExpression: params.cronExpression,
      isRecurring: params.isRecurring,
    });

    return {
      success: true,
      message: `Pengingat berhasil dijadwalkan untuk ${targetDate.toLocaleString("id-ID", { timeZone: context.user.timezone })}.`,
      reminderId: reminder.id,
    };
  },
};

export const listRemindersTool: ToolDefinition = {
  name: "list_reminders",
  description: "Melihat daftar seluruh pengingat aktif yang belum terlaksana.",
  permission: "READ_ONLY",
  schema: z.object({}),
  execute: async (_params, context) => {
    const reminders = await remindersService.listReminders(context.user.id);
    return {
      count: reminders.length,
      reminders: reminders.map((r) => ({
        id: r.id,
        message: r.message,
        targetTime: r.targetTimeUtc.toLocaleString("id-ID", { timeZone: context.user.timezone }),
        isRecurring: r.isRecurring,
        cronExpression: r.cronExpression,
      })),
    };
  },
};

export const cancelReminderTool: ToolDefinition<{ reminderId: string }> = {
  name: "cancel_reminder",
  description: "Membatalkan pengingat yang aktif berdasarkan ID pengingat.",
  permission: "USER_WRITE",
  schema: z.object({
    reminderId: z.string().describe("ID pengingat yang ingin dibatalkan"),
  }),
  execute: async (params, context) => {
    const success = await remindersService.cancelReminder(context.user.id, params.reminderId);
    return {
      success,
      message: success ? "Pengingat berhasil dibatalkan." : "Pengingat tidak ditemukan atau sudah selesai.",
    };
  },
};
