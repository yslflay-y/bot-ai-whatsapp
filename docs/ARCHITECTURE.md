# Architecture Specification: Production-Ready WhatsApp AI Assistant

## 1. System Architecture Overview

The system follows a modular layered architecture with clean boundaries, loose coupling, and dependency injection.

```
                  ┌───────────────────────────────┐
                  │    WhatsApp Web Socket        │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │  WhatsApp Provider (Baileys)  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │      Message Pipeline         │
                  │  (Validation & Normalization) │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │       Access Control          │
                  │  (Allowlist, User, Roles)     │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │       Idempotency Gate        │
                  │   (Redis Message Deduplication│
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │        Message Router         │
                  └──────┬─────────────────┬──────┘
                         │                 │
                         ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ Command Core │  │   AI Agent   │
                  │ (/note, etc) │  │  Orchestrator│
                  └──────┬───────┘  └──────┬───────┘
                         │                 │
                         └────────┬────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    Tool Execution Registry    │
                  └──────────────┬────────────────┘
                                 │
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
      │ Memory Svc   │    │  Notes Svc   │    │ Reminder Svc │
      └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │      AI Provider Adapter      │
                  │  (Gemini / Fallback OpenAI)   │
                  └───────────────────────────────┘
```

---

## 2. Component Layers & Interfaces

### 2.1 WhatsApp Provider Layer (`src/modules/whatsapp/`)
- `WhatsAppProvider` interface abstracts WhatsApp connectivity.
- `BaileysAdapter` implements `WhatsAppProvider` using `@whiskeysockets/baileys`.
- Persists session keys safely (`useMultiFileAuthState` or custom secure storage).
- Emits standardized domain events:
  - `message.received`: Incoming user text, media, or voice note.
  - `connection.update`: Connection status changes (connecting, open, close, reconnecting).
  - `qr.received`: Emitted when QR code authentication is required.

### 2.2 Ingestion & Security Pipeline (`src/modules/messaging/`)
- **Sanitizer & Parser**: Normalizes phone numbers to standard E.164 and WhatsApp JID (`<number>@s.whatsapp.net`).
- **Access Control Filter**: Checks sender against `ALLOWLIST_NUMBERS` in configuration and database. If unauthorized, silently drops or logs rejection without invoking expensive AI or LLM tokens.
- **Idempotency Filter**: Checks Redis key `msg:dedup:<messageId>`. If present, skips processing. Sets key with 1-hour TTL.

### 2.3 Command vs. AI Router (`src/modules/messaging/router.ts`)
- Explicit commands (e.g., `/note`, `/status`, `/help`, `/reminders`) are handled deterministically without LLM overhead.
- Natural language messages are routed to the **AI Agent Orchestrator**.

### 2.4 AI Agent & Tool Orchestration (`src/modules/ai/` & `src/modules/tools/`)
- `AIProvider` interface:
  - `generateResponse(context: AIContext): Promise<AIResponse>`
  - Supports system instructions, message history, multimodal media (audio/image), and function declarations.
- Tool Calling Engine:
  - Validates tool arguments using Zod schemas.
  - Enforces permission categories (read-only, write, admin).
  - Executes tools inside bounded timeouts and error-isolation wrappers.

### 2.5 Persistence & Background Workers (`src/infrastructure/` & `src/workers/`)
- **PostgreSQL**: Stores persistent relational entities:
  - Users, Conversations, Messages, Memories, Notes, Reminders, ToolExecutions, AuditLogs.
- **Redis & BullMQ**:
  - `reminderQueue`: Schedules delayed and recurring reminder jobs.
  - `transcriptionQueue`: Asynchronously converts and transcribes heavy audio payloads.
  - `cleanupQueue`: Purges temporary media and expired caches.

---

## 3. Data Flow Diagrams

### 3.1 Voice Note Processing Flow
```
User sends Voice Note
  ──> Baileys emits message with audio/ogg
  ──> Access Control approves sender
  ──> Idempotency check passes
  ──> Audio buffer saved to temporary storage
  ──> ffmpeg converts audio (if needed) to 16kHz WAV/MP3
  ──> Gemini / Whisper API transcribes audio to text
  ──> Text passed into Conversation Pipeline
  ──> AI generates response + executes tools (if requested)
  ──> WhatsApp Provider sends reply to user
  ──> Temporary audio file cleaned up
```

### 3.2 Reminder Scheduling & Execution
```
User: "Ingatkan saya besok jam 8 backup VPS"
  ──> AI identifies tool call: create_reminder
  ──> Tool orchestrator parses timezone and target UTC timestamp
  ──> Stored in PostgreSQL `reminders` table with status `SCHEDULED`
  ──> BullMQ delayed job added with delay = (targetTime - now)
  ──> When job fires:
        BullMQ worker picks up job
        Worker checks database if reminder is still active/un-cancelled
        Worker formats message
        WhatsAppProvider dispatches reminder message to user
        Database status updated to `COMPLETED`
```

---

## 4. Error Handling & Degradation Strategy
- **AI Downtime**: Fallback provider invoked; if all AI fail, fallback to helpful deterministic error message without crash.
- **WhatsApp Disconnect**: Baileys reconnect loop with exponential backoff; message queue buffers outgoing messages.
- **Database Failure**: Transactions rolled back cleanly; health check `/health` reports `unhealthy`.
