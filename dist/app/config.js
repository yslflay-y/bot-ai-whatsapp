import { config as loadDotenv } from "dotenv";
import { z } from "zod";
loadDotenv();
const commaSeparatedStringToArray = z
    .string()
    .optional()
    .default("")
    .transform((val) => val
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0));
const ConfigSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace"])
        .default("info"),
    // WhatsApp Access Control
    ALLOWLIST_NUMBERS: commaSeparatedStringToArray,
    ADMIN_NUMBERS: commaSeparatedStringToArray,
    DEFAULT_TIMEZONE: z.string().default("Asia/Jakarta"),
    // Database (PostgreSQL)
    DATABASE_URL: z
        .string()
        .default("postgresql://assistant:securepassword@localhost:5432/whatsapp_assistant?schema=public"),
    // Redis & Queue
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional().default(""),
    REDIS_DB: z.coerce.number().default(0),
    // AI Providers
    PRIMARY_AI_PROVIDER: z.enum(["gemini", "openai", "groq"]).default("gemini"),
    GEMINI_API_KEY: z.string().optional().default(""),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
    // Fallbacks
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    GROQ_API_KEY: z.string().optional().default(""),
    // Media & Auth Storage
    MEDIA_STORAGE_PATH: z.string().default("./data/media"),
    AUTH_STATE_PATH: z.string().default("./data/auth"),
    MAX_FILE_SIZE_MB: z.coerce.number().default(15),
    // Security & Limits
    RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().default(15),
    SSRF_TIMEOUT_MS: z.coerce.number().default(8000),
});
function loadConfig() {
    const result = ConfigSchema.safeParse(process.env);
    if (!result.success) {
        // eslint-disable-next-line no-console
        console.error("Configuration validation failed:", result.error.format());
        throw new Error("Invalid application configuration");
    }
    return result.data;
}
export const config = loadConfig();
