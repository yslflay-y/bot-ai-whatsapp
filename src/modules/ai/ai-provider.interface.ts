export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIMediaAttachment {
  mimeType: string;
  data: Buffer;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AIGenerateOptions {
  systemPrompt: string;
  messages: AIMessage[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  media?: AIMediaAttachment[];
}

export interface AIGenerateResult {
  text: string;
  toolCalls?: AIToolCall[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  model: string;
  provider: string;
}

export interface AIProvider {
  readonly providerName: string;
  generate(options: AIGenerateOptions): Promise<AIGenerateResult>;
}
