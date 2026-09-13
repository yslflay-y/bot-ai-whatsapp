# Project Specification: Production-Ready WhatsApp AI Assistant

## 1. Overview
A production-grade, self-hosted WhatsApp AI Assistant designed to run continuously on a Linux VPS. It provides a personal AI assistant interface via WhatsApp, incorporating persistent conversation history, long-term memory, notes, reminders, tool calling, media processing (audio transcription, image understanding), and server monitoring, built with resilience, security, and strict data integrity.

---

## 2. Core Capabilities & Functional Requirements

### 2.1 Natural Language AI & Context Management
- Powered by **Google Gemini** as the primary AI provider (supporting multimodal input, tool/function calling, system prompts).
- Secondary / Fallback providers supported via unified `AIProvider` interface (OpenAI, Groq).
- Persistent conversation history stored in PostgreSQL (per user/chat).
- Dynamic sliding window context management (summarization / truncation to fit token bounds without unbounded growth).
- Tracking of token consumption and estimated costs per interaction.

### 2.2 Explicit Long-Term Memory
- Separate from transient conversational context.
- Stores facts, preferences, and operational rules explicitly directed by the user (e.g. *"Ingat saya suka jawaban singkat"*, *"Remember that my main server runs Ubuntu"*).
- CRUD operations for memories: Create, Read/List, Search (semantic & keyword), Update, and Delete.

### 2.3 Notes System
- Dual input mode: Natural language detection (e.g., *"Catat: ide project monitoring VPS"*) and explicit slash commands (e.g., `"/note beli kabel LAN"`).
- Full CRUD operations: Create, Search, List, Update, Delete.

### 2.4 Reminders & Scheduling
- Support for one-time reminders (e.g., *"Ingatkan saya besok jam 8 backup VPS"*) and recurring cron-based reminders (e.g., *"Setiap Senin jam 9 ingatkan saya backup server"*).
- Fully timezone-aware parsing and storage (stored internally as UTC timestamps, displayed in user's configured timezone).
- Backed by PostgreSQL and scheduled via **BullMQ + Redis**.
- Must survive application, container, and VPS restarts without losing or repeating scheduled jobs.

### 2.5 Media Understanding
- **Voice Notes**: WhatsApp voice notes (audio/ogg, opus) downloaded safely -> converted via ffmpeg -> transcribed using Gemini Multimodal / Whisper -> passed to AI conversational pipeline.
- **Images**: Vision-capable image inspection with accompanying user captions.
- **Documents**: File validation (strict MIME-type whitelist, file size limits, safe non-user-controlled disk paths).

### 2.6 URL Summarization & SSRF Protection
- Natural language and command trigger to summarize web page content (e.g., *"Rangkum https://example.com/article"*).
- Strict Server-Side Request Forgery (SSRF) defense:
  - Whitelist HTTP/HTTPS only.
  - Reject localhost, loopback (`127.0.0.0/8`, `::1`), private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local addresses (`169.254.0.0/16`), and AWS metadata endpoints.
  - DNS resolution validation before connect to mitigate DNS rebinding attacks.
  - Response size limit (e.g., max 2MB) and connection timeout.
  - Content treated as untrusted prompt data (shielded from prompt injection).

### 2.7 System & Server Monitoring
- Safe, read-only system status tools (`get_server_status`) reporting CPU utilization, memory, disk usage, container health, and uptime.
- Never expose arbitrary shell or root command execution to AI prompts.

### 2.8 Controlled AI Tool Registry
Tools are registered with strict JSON schemas, permission gates, and execution bounds:
- `get_current_time`
- `get_server_status`
- `create_note`
- `search_notes`
- `create_reminder`
- `list_reminders`
- `cancel_reminder`
- `remember`
- `forget_memory`
- `summarize_url`

---

## 3. Non-Functional & Operational Requirements

### 3.1 Reliability & Fault Tolerance
- Automatic reconnection with exponential backoff on WhatsApp disconnection.
- Graceful handling of external AI provider downtime, network timeouts, and Redis restarts.
- Application crash isolation: Worker tasks retry on failure with dead-letter queue (DLQ) support.

### 3.2 Access Control & Security
- Strict allowlist of WhatsApp phone numbers / JIDs.
- Reject unauthenticated/unauthorized messages immediately before invoking any AI or transcription service.
- Server-side role-based authorization (`admin`, `user`).
- Never leak stack traces or raw technical error logs to WhatsApp chat.
- Secrets kept strictly in environment variables; zero hardcoding.

### 3.3 Idempotency & Deduplication
- WhatsApp events can be delivered more than once.
- Incoming WhatsApp `messageId` tracked with Redis TTL and PostgreSQL unique constraints to prevent duplicate responses, duplicate notes, or duplicate reminder scheduling.

### 3.4 Observability
- Structured JSON logging with **Pino**, masking sensitive values (phone numbers, tokens, passwords).
- HTTP server with `/health` and `/ready` endpoints verifying DB and Redis connectivity.
- Metric counters for received/processed messages, AI requests, AI errors, and tool executions.

---

## 4. Technology Stack
- **Runtime**: Node.js v24 LTS
- **Language**: TypeScript 5.x
- **WhatsApp Integration**: `@whiskeysockets/baileys`
- **Database**: PostgreSQL 16+ via **Prisma ORM**
- **Queue / Caching**: Redis 7+ via **BullMQ** & **ioredis**
- **AI / LLM**: Google Gemini API (`@google/genai`), fallback OpenAI / Groq
- **HTTP Engine**: Fastify
- **Audio Processing**: ffmpeg
- **Validation**: Zod
- **Testing**: Vitest
- **Containerization**: Docker (multi-stage build) & Docker Compose
