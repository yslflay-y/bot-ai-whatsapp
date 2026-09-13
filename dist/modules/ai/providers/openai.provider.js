import OpenAI from "openai";
import { config } from "../../../app/config.js";
import { AIProviderError } from "../../../shared/errors/app-error.js";
import { logger } from "../../../infrastructure/logging/logger.js";
export class OpenAIProvider {
    providerName;
    client = null;
    model;
    constructor(apiKey, model, baseURL, providerName = "openai") {
        this.providerName = providerName;
        const key = apiKey || config.OPENAI_API_KEY;
        this.model = model || config.OPENAI_MODEL || "gpt-4o-mini";
        if (key) {
            this.client = new OpenAI({ apiKey: key, baseURL });
        }
    }
    async generate(options) {
        if (!this.client) {
            throw new AIProviderError(`${this.providerName} API key is not configured`, "Penyedia AI fallback belum dikonfigurasi.");
        }
        try {
            const messages = [
                { role: "system", content: options.systemPrompt },
            ];
            for (const m of options.messages) {
                messages.push({
                    role: m.role,
                    content: m.content,
                });
            }
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
                temperature: options.temperature ?? 0.7,
            });
            const choice = response.choices[0];
            const text = choice?.message?.content || "";
            const toolCalls = [];
            if (choice?.message?.tool_calls) {
                for (const tc of choice.message.tool_calls) {
                    try {
                        toolCalls.push({
                            id: tc.id,
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments || "{}"),
                        });
                    }
                    catch {
                        logger.warn({ raw: tc.function.arguments }, "Failed to parse OpenAI tool call JSON");
                    }
                }
            }
            const usage = response.usage;
            const promptTokens = usage?.prompt_tokens || 0;
            const completionTokens = usage?.completion_tokens || 0;
            const totalTokens = usage?.total_tokens || promptTokens + completionTokens;
            // GPT-4o-mini estimate: $0.15 / 1M prompt, $0.60 / 1M completion
            const estimatedCostUsd = (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
            return {
                text,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCostUsd,
                model: this.model,
                provider: this.providerName,
            };
        }
        catch (err) {
            logger.error({ err, provider: this.providerName }, "OpenAI/Fallback API error");
            throw new AIProviderError(`OpenAI API Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
