import os from "node:os";
import { z } from "zod";
import { ToolDefinition } from "../tool.interface.js";

/**
 * Tool to retrieve the current date and time in the user's timezone.
 */
export const getCurrentTimeTool: ToolDefinition = {
  name: "get_current_time",
  description: "Mendapatkan waktu, tanggal, dan hari saat ini sesuai zona waktu pengguna.",
  permission: "READ_ONLY",
  schema: z.object({}),
  execute: async (_params, context) => {
    const timezone = context.user.timezone || "Asia/Jakarta";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    });

    return {
      currentTime: formatter.format(now),
      isoUtc: now.toISOString(),
      timezone,
    };
  },
};

/**
 * Safe, read-only tool to inspect server and application runtime metrics.
 * Strictly restricted to ADMIN users. Never executes arbitrary shell commands.
 */
export const getServerStatusTool: ToolDefinition = {
  name: "get_server_status",
  description: "Melihat status kesehatan server VPS, penggunaan RAM, CPU, dan waktu aktif aplikasi (Khusus Admin).",
  permission: "ADMIN_ONLY",
  schema: z.object({}),
  execute: async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

    const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(0) + " MB";

    const processMem = process.memoryUsage();
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || "Unknown",
      cpuLoadAvg1m: os.loadavg()[0]?.toFixed(2) || "N/A",
      memory: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
        usagePercent: `${memUsagePercent}%`,
      },
      process: {
        nodeVersion: process.version,
        rss: formatBytes(processMem.rss),
        heapUsed: formatBytes(processMem.heapUsed),
        uptime: `${hours} jam ${minutes} menit`,
      },
      status: "HEALTHY",
    };
  },
};
