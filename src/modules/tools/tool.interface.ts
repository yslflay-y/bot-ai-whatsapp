import { z } from "zod";
import { User, Role } from "@prisma/client";

export type ToolPermission = "READ_ONLY" | "USER_WRITE" | "ADMIN_ONLY";

export interface ToolExecutionContext {
  user: User;
  conversationId: string;
  messageId?: string;
}

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  permission: ToolPermission;
  schema: z.ZodType<TParams>;
  execute: (params: TParams, context: ToolExecutionContext) => Promise<TResult>;
}

export function isToolAuthorized(tool: ToolDefinition, userRole: Role): boolean {
  if (tool.permission === "ADMIN_ONLY") {
    return userRole === Role.ADMIN;
  }
  return true;
}
