# Implementation Roadmap: WhatsApp AI Assistant

This roadmap defines the sequential development phases. Every phase must pass type checking, linting, and automated tests before moving forward.

---

## Phase 1: Project Setup, Specification & Tooling
- [x] Create core specifications (`docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`).
- [ ] Initialize TypeScript Node.js project (`package.json`, `tsconfig.json`, `pnpm-lock.yaml`).
- [ ] Setup linting and formatting (Biome / ESLint + Prettier).
- [ ] Setup testing framework (Vitest).
- [ ] Setup `.env.example` with comprehensive documentation of configuration keys.
- [ ] Setup base directory structure (`src/`, `tests/`, `migrations/`).

## Phase 2: Database Layer & Persistence (PostgreSQL + Prisma)
- [ ] Setup Prisma ORM with PostgreSQL driver.
- [ ] Define comprehensive relational schema:
  - `User` (JID, phone number, name, role, timezone, preferences, createdAt, updatedAt)
  - `Conversation` (userId, title, isActive, createdAt, updatedAt)
  - `Message` (conversationId, externalMessageId, senderType, content, contentType, tokenCount, metadata, createdAt)
  - `Memory` (userId, key, content, category, createdAt, updatedAt)
  - `Note` (userId, title, content, tags, createdAt, updatedAt)
  - `Reminder` (userId, message, targetTimeUtc, cronExpression, isRecurring, status, createdAt, updatedAt)
  - `ScheduledJob` (jobId, type, payload, runAt, status, attempts, lastError)
  - `Media` (userId, messageId, originalName, mimeType, sizeBytes, storagePath, createdAt)
  - `ToolExecution` (messageId, toolName, inputParams, outputResult, status, durationMs, createdAt)
  - `AiUsage` (userId, model, promptTokens, completionTokens, totalTokens, estimatedCostUsd, createdAt)
  - `AuditLog` (userId, action, resource, details, ipAddress, createdAt)
  - `SystemSetting` (key, value, description, updatedAt)
- [ ] Generate initial database migrations.
- [ ] Write database client wrapper with connection health check and retry capability.

## Phase 3: Shared Modules, Configuration & Job Queue
- [ ] Environment configuration parser with Zod schema validation (`src/app/config.ts`).
- [ ] Custom typed application errors (`ValidationError`, `AuthorizationError`, `RateLimitError`, `DatabaseError`, `AIProviderError`, etc.).
- [ ] Structured logger with Pino (`src/infrastructure/logging/logger.ts`) with redaction of secrets.
- [ ] Redis connection manager (`src/infrastructure/redis/redis.client.ts`).
- [ ] BullMQ queue manager and worker scaffolding (`src/infrastructure/queue/queue.manager.ts`).

## Phase 4: Message Pipeline, Security & Access Control
- [ ] Phone number normalizer & JID parser (supports E.164, Indonesian local 08xx, and international formats).
- [ ] Access control service (`src/modules/permissions/access-control.service.ts`).
- [ ] Redis-backed idempotency service (`src/modules/messaging/idempotency.service.ts`).
- [ ] Message router (Commands vs. AI Agent) (`src/modules/messaging/router.ts`).
- [ ] Unit tests for access control, idempotency, and routing.

## Phase 5: AI Provider & Tool Registry Engine
- [ ] `AIProvider` abstraction interface and types (`src/modules/ai/ai-provider.interface.ts`).
- [ ] Gemini Provider implementation with function calling and multimodal support (`src/modules/ai/providers/gemini.provider.ts`).
- [ ] Fallback AI Provider (OpenAI/Groq compatible) (`src/modules/ai/providers/openai.provider.ts`).
- [ ] AI Service orchestrator with bounded retries, timeout, and token usage tracking (`src/modules/ai/ai.service.ts`).
- [ ] Tool registry and execution engine (`src/modules/tools/tool.registry.ts`).
- [ ] Core tool implementations:
  - `get_current_time` (user timezone-aware)
  - `get_server_status` (system CPU, RAM, uptime)
  - `create_note`, `search_notes`, `list_notes`, `delete_note`
  - `create_reminder`, `list_reminders`, `cancel_reminder`
  - `remember`, `search_memories`, `forget_memory`
  - `summarize_url` with strict SSRF protection

## Phase 6: Memory, Notes, Reminders & Background Workers
- [ ] Long-term memory service (`src/modules/memory/memory.service.ts`).
- [ ] Notes management service (`src/modules/notes/notes.service.ts`).
- [ ] Reminders service and BullMQ worker (`src/modules/reminders/reminders.service.ts` & `reminder.worker.ts`).
- [ ] Restart-safe reminder recovery on application startup.
- [ ] Unit tests for memory, notes, and reminder scheduling.

## Phase 7: WhatsApp Provider (Baileys) & Multimodal Media
- [ ] `WhatsAppProvider` interface definition.
- [ ] Baileys adapter implementation with persistent authentication state (`src/modules/whatsapp/baileys.adapter.ts`).
- [ ] QR code generator (terminal & web / log).
- [ ] Audio downloader and ffmpeg conversion utility (`src/modules/media/audio.converter.ts`).
- [ ] Voice note transcription pipeline (`src/modules/transcription/transcription.service.ts`).
- [ ] Image downloader and multimodal integration.

## Phase 8: HTTP Server, Observability & Lifecycle Management
- [ ] Fastify HTTP server (`/health`, `/ready`, `/metrics`).
- [ ] Dependency injection container (`src/app/container.ts`).
- [ ] Graceful shutdown orchestrator (`src/main.ts`) managing Baileys, Redis, BullMQ workers, and PostgreSQL connections.

## Phase 9: Dockerization, CI/CD & Deployment
- [ ] Multi-stage Dockerfile with non-root security and ffmpeg.
- [ ] `docker-compose.yml` defining `app`, `postgres`, and `redis` on a private bridge network with persistent named volumes.
- [ ] Automated backup script (`scripts/backup.sh`) and restore script (`scripts/restore.sh`).
- [ ] GitHub Actions CI workflow (`.github/workflows/ci.yml`).

## Phase 10: Verification & End-to-End Validation
- [ ] Full test suite execution (`pnpm test`).
- [ ] Type check and lint check (`pnpm run typecheck`, `pnpm run lint`).
- [ ] Docker container build and startup verification.
- [ ] Final production readiness verification and walkthrough documentation.
