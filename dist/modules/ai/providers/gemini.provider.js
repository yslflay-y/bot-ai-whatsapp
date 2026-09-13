import { GoogleGenAI } from "@google/genai";
import { config } from "../../../app/config.js";
import { AIProviderError } from "../../../shared/errors/app-error.js";
import { logger } from "../../../infrastructure/logging/logger.js";
export class GeminiProvider {
    providerName = "gemini";
    client = null;
    model;
    constructor(apiKey, model) {
        const key = apiKey || config.GEMINI_API_KEY;
        this.model = model || config.GEMINI_MODEL || "gemini-2.0-flash";
        if (key) {
            this.client = new GoogleGenAI({ apiKey: key });
        }
    }
    async generate(options) {
        if (!this.client) {
            throw new AIProviderError("Gemini API key is not configured", "Layanan AI belum dikonfigurasi dengan API key yang valid.");
        }
        try {
            // Format messages into Gemini contents structure
            const contents = [];
            for (const msg of options.messages) {
                if (msg.role === "system")
                    continue; // system prompt passed via config.systemInstruction
                contents.push({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }],
                });
            }
            // If media attachments are present in the current prompt, attach them to the last user message
            if (options.media && options.media.length > 0) {
                const lastMsg = contents[contents.length - 1];
                if (lastMsg && lastMsg.role === "user") {
                    for (const item of options.media) {
                        lastMsg.parts.push({
                            inlineData: {
                                mimeType: item.mimeType,
                                data: item.data.toString("base64"),
                            },
                        });
                    }
                }
            }
            const generateConfig = {
                systemInstruction: options.systemPrompt,
                temperature: options.temperature ?? 0.7,
            };
            if (options.tools && options.tools.length > 0) {
                generateConfig.tools = [{ functionDeclarations: options.tools }];
            }
            const response = await this.client.models.generateContent({
                model: this.model,
                contents,
                config: generateConfig,
            });
            const responseText = response.text || "";
            const toolCalls = [];
            // Extract function calls
            if (response.functionCalls && response.functionCalls.length > 0) {
                for (const fc of response.functionCalls) {
                    toolCalls.push({
                        id: `call_${Math.random().toString(36).substring(2, 9)}`,
                        name: fc.name || "unknown",
                        args: fc.args || {},
                    });
                }
            }
            const usage = response.usageMetadata;
            const promptTokens = usage?.promptTokenCount || 0;
            const completionTokens = usage?.candidatesTokenCount || 0;
            const totalTokens = usage?.totalTokenCount || promptTokens + completionTokens;
            // Gemini 2.0 Flash pricing estimate: $0.10 / 1M input, $0.40 / 1M output
            const estimatedCostUsd = (promptTokens / 1_000_000) * 0.1 + (completionTokens / 1_000_000) * 0.4;
            return {
                text: responseText,
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
            logger.error({ err, model: this.model }, "Gemini API error during generate");
            throw new AIProviderError(`Gemini API Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
