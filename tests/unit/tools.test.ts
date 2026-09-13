import { describe, it, expect, beforeEach } from "vitest";
import { toolRegistry } from "../../src/modules/tools/tool.registry.js";
import { registerAllCoreTools } from "../../src/modules/tools/definitions/index.js";
import { Role } from "@prisma/client";

describe("Tool Registry & Execution Engine", () => {
  beforeEach(() => {
    registerAllCoreTools();
  });

  it("registers all core tools", () => {
    const tools = toolRegistry.getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(10);
    expect(toolRegistry.getTool("get_current_time")).toBeDefined();
    expect(toolRegistry.getTool("get_server_status")).toBeDefined();
    expect(toolRegistry.getTool("summarize_url")).toBeDefined();
  });

  it("executes get_current_time tool safely", async () => {
    const mockUser: any = {
      id: "usr_123",
      role: Role.USER,
      timezone: "Asia/Jakarta",
    };

    const result = await toolRegistry.executeTool("get_current_time", {}, {
      user: mockUser,
      conversationId: "conv_123",
    });

    expect(result.success).toBe(true);
    const data = result.result as any;
    expect(data.timezone).toBe("Asia/Jakarta");
    expect(data.currentTime).toBeDefined();
    expect(data.isoUtc).toBeDefined();
  });

  it("blocks non-admin users from executing get_server_status", async () => {
    const regularUser: any = {
      id: "usr_regular",
      role: Role.USER,
    };

    await expect(
      toolRegistry.executeTool("get_server_status", {}, {
        user: regularUser,
        conversationId: "conv_123",
      })
    ).rejects.toThrow("unauthorized for tool get_server_status");
  });

  it("allows ADMIN users to execute get_server_status", async () => {
    const adminUser: any = {
      id: "usr_admin",
      role: Role.ADMIN,
    };

    const result = await toolRegistry.executeTool("get_server_status", {}, {
      user: adminUser,
      conversationId: "conv_123",
    });

    expect(result.success).toBe(true);
    const data = result.result as any;
    expect(data.status).toBe("HEALTHY");
    expect(data.memory).toBeDefined();
    expect(data.process).toBeDefined();
  });

  it("validates input schema parameters", async () => {
    const mockUser: any = {
      id: "usr_123",
      role: Role.USER,
    };

    // summarize_url requires a valid URL
    const result = await toolRegistry.executeTool(
      "summarize_url",
      { url: "not-a-valid-url" },
      { user: mockUser, conversationId: "conv_123" }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Parameter tidak valid");
  });
});
