import { Role } from "@prisma/client";
import { isToolAuthorized } from "./tool.interface.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { AuthorizationError, ValidationError } from "../../shared/errors/app-error.js";
export class ToolRegistry {
    tools = new Map();
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        logger.debug({ toolName: tool.name }, "Registered tool in registry");
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getAllTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Generates OpenAI-compatible tool specifications.
     */
    getOpenAITools(userRole = Role.USER) {
        return this.getAllTools()
            .filter((tool) => isToolAuthorized(tool, userRole))
            .map((tool) => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.schema._def ? this.zodToJsonSchema(tool.schema) : {},
            },
        }));
    }
    /**
     * Generates Gemini-compatible function declarations.
     */
    getGeminiFunctionDeclarations(userRole = Role.USER) {
        return this.getAllTools()
            .filter((tool) => isToolAuthorized(tool, userRole))
            .map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: this.zodToJsonSchema(tool.schema),
        }));
    }
    /**
     * Converts a Zod schema to an OpenAPI / JSON schema suitable for LLMs.
     */
    zodToJsonSchema(schema) {
        // Safe extraction or default object
        try {
            if (schema && schema._def && schema._def.shape) {
                const shape = schema._def.shape();
                const properties = {};
                const required = [];
                for (const [key, field] of Object.entries(shape)) {
                    const fieldDef = field._def;
                    const typeName = fieldDef?.typeName;
                    const isOptional = typeName === "ZodOptional" || typeName === "ZodDefault";
                    let type = "string";
                    if (typeName === "ZodNumber")
                        type = "number";
                    else if (typeName === "ZodBoolean")
                        type = "boolean";
                    else if (typeName === "ZodArray")
                        type = "array";
                    else if (typeName === "ZodObject")
                        type = "object";
                    properties[key] = {
                        type,
                        description: fieldDef?.description || key,
                    };
                    if (!isOptional) {
                        required.push(key);
                    }
                }
                return {
                    type: "object",
                    properties,
                    required: required.length > 0 ? required : undefined,
                };
            }
        }
        catch (e) {
            logger.warn({ e }, "Error converting zod schema to json schema");
        }
        return { type: "object", properties: {} };
    }
    /**
     * Executes a tool by name with parameter validation, permission checks, and audit logging.
     */
    async executeTool(toolName, rawParams, context) {
        const tool = this.getTool(toolName);
        if (!tool) {
            return { success: false, error: `Tool ${toolName} tidak ditemukan.` };
        }
        // Permission check
        if (!isToolAuthorized(tool, context.user.role)) {
            throw new AuthorizationError(`User ${context.user.id} unauthorized for tool ${toolName}`, `Anda tidak memiliki hak akses untuk menggunakan fitur ${toolName}.`);
        }
        // Schema validation
        const parseResult = tool.schema.safeParse(rawParams);
        if (!parseResult.success) {
            const issues = parseResult.error.issues.map((i) => i.message).join(", ");
            return { success: false, error: `Parameter tidak valid: ${issues}` };
        }
        const startTime = Date.now();
        let status = "SUCCESS";
        let outputResult = null;
        let errorMessage = undefined;
        try {
            outputResult = await tool.execute(parseResult.data, context);
            return { success: true, result: outputResult };
        }
        catch (err) {
            status = "FAILED";
            errorMessage = err instanceof Error ? err.message : String(err);
            logger.error({ toolName, params: rawParams, err }, "Tool execution failure");
            return {
                success: false,
                error: err instanceof ValidationError ? err.userFacingMessage : "Gagal mengeksekusi aksi.",
            };
        }
        finally {
            const durationMs = Date.now() - startTime;
            // Persist to tool_executions table in PostgreSQL
            try {
                await prisma.toolExecution.create({
                    data: {
                        messageId: context.messageId || null,
                        toolName,
                        inputParams: rawParams,
                        outputResult: outputResult ? outputResult : null,
                        status,
                        durationMs,
                        error: errorMessage || null,
                    },
                });
            }
            catch (dbErr) {
                logger.error({ dbErr }, "Failed to persist tool execution log to database");
            }
        }
    }
}
export const toolRegistry = new ToolRegistry();
