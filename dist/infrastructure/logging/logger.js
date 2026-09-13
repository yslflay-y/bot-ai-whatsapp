import pino from "pino";
import { config } from "../../app/config.js";
const redactPaths = [
    "*.password",
    "*.token",
    "*.apiKey",
    "*.secret",
    "*.authorization",
    "*.cookie",
    "*.DATABASE_URL",
    "*.GEMINI_API_KEY",
    "*.OPENAI_API_KEY",
    "*.GROQ_API_KEY",
    "req.headers.authorization",
    "req.headers.cookie",
];
export const logger = pino({
    level: config.LOG_LEVEL,
    redact: {
        paths: redactPaths,
        censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: config.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
                ignore: "pid,hostname",
            },
        }
        : undefined,
});
