import { toolRegistry } from "../tool.registry.js";
import { getCurrentTimeTool, getServerStatusTool } from "./system.tools.js";
import { summarizeUrlTool } from "./url.tools.js";
import { createNoteTool, searchNotesTool, listNotesTool, deleteNoteTool } from "./notes.tools.js";
import { rememberTool, searchMemoriesTool, forgetMemoryTool } from "./memory.tools.js";
import { createReminderTool, listRemindersTool, cancelReminderTool } from "./reminders.tools.js";
import { logger } from "../../../infrastructure/logging/logger.js";
export function registerAllCoreTools() {
    // System Tools
    toolRegistry.registerTool(getCurrentTimeTool);
    toolRegistry.registerTool(getServerStatusTool);
    // Web & URL Tools
    toolRegistry.registerTool(summarizeUrlTool);
    // Notes Tools
    toolRegistry.registerTool(createNoteTool);
    toolRegistry.registerTool(searchNotesTool);
    toolRegistry.registerTool(listNotesTool);
    toolRegistry.registerTool(deleteNoteTool);
    // Memory Tools
    toolRegistry.registerTool(rememberTool);
    toolRegistry.registerTool(searchMemoriesTool);
    toolRegistry.registerTool(forgetMemoryTool);
    // Reminder Tools
    toolRegistry.registerTool(createReminderTool);
    toolRegistry.registerTool(listRemindersTool);
    toolRegistry.registerTool(cancelReminderTool);
    logger.info({ totalTools: toolRegistry.getAllTools().length }, "All core tools registered successfully");
}
