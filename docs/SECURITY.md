# Security Specification: Production-Ready WhatsApp AI Assistant

## 1. Threat Model & Security Principles

### 1.1 Core Principles
1. **Zero Trust on External Input**: All WhatsApp messages, URLs, media attachments, and AI-generated tool parameters are treated as completely untrusted.
2. **Early Boundary Filtering**: Unauthorized requests are rejected at the edge before allocating memory, invoking background jobs, or making expensive LLM API calls.
3. **No Unrestricted Execution**: The AI engine is strictly prohibited from executing arbitrary shell, bash, or terminal commands. System monitoring tools only execute strictly whitelisted read-only inspection functions.
4. **Least Privilege**: The service runs as a non-root user in Docker containers. Database users only have permissions on the application database.
5. **No Secret Leakage**: API tokens, database connection strings, and WhatsApp auth secrets are never committed to version control, never returned in user error messages, and masked in structured logs.

---

## 2. Access Control & Authorization

### 2.1 Allowlist Enforcement
- The system checks incoming JIDs against the configured `ALLOWLIST_NUMBERS`.
- Supported format: E.164 without symbols (e.g., `6281234567890`) or full JID (`6281234567890@s.whatsapp.net`).
- If an unknown sender messages the bot:
  - The request is immediately logged with level `WARN`.
  - The message pipeline terminates immediately without calling AI or queueing jobs.
  - Optional: A polite unauthorized message can be sent once or dropped silently to prevent enumeration.

### 2.2 Role-Based Authorization
- **Roles**:
  - `ADMIN`: Full access to admin commands, server status tools, user management, and system settings.
  - `USER`: Access to normal conversational AI, notes, reminders, memories, and personal tools.
- Role checks are performed by server-side code, **never** determined by the AI prompt or LLM interpretation.

---

## 3. Server-Side Request Forgery (SSRF) Protection

When users request web page summarization (e.g. `summarize_url` or *"Rangkum https://..."*):
1. **Protocol Whitelist**: Only `http:` and `https:` are permitted. `file:`, `gopher:`, `ftp:`, `data:` are blocked.
2. **IP & Subnet Blacklist**:
   - `127.0.0.0/8` (Localhost)
   - `::1` (IPv6 Localhost)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC 1918 networks)
   - `169.254.0.0/16` (Link-local, AWS/GCP metadata service `169.254.169.254`)
   - `fc00::/7`, `fe80::/10` (IPv6 Unique Local & Link-local)
3. **DNS Rebinding Defense**:
   - Hostnames are resolved to IP addresses before initiating the HTTP connection.
   - The resolved IP is evaluated against the blacklist.
   - The request is made directly to the resolved IP or with pinned IP validation.
4. **Content & Size Constraints**:
   - Maximum download size: 2 MB (prevents memory exhaustion or decompression bombs).
   - Maximum execution timeout: 8000 ms.
   - HTML body parsed to sanitized markdown/text before feeding to AI context.
   - Retrieved web content is demarcated within untrusted data tags in the LLM prompt to prevent prompt injection.

---

## 4. Media & File Handling Security

### 4.1 Upload & Download Controls
- File names provided by WhatsApp are never used directly as disk paths.
- All stored media files use cryptographically random UUIDs (`${uuidv4()}.${extension}`).
- Path traversal defense: paths are strictly resolved inside designated temporary scratch directories (`/tmp/whatsapp-media` or `./data/media`).
- Automatic TTL cleanup: downloaded media files are deleted immediately after transcription or processing is complete.

### 4.2 MIME Type Validation
- Verification of magic bytes / file headers rather than trusting sender-supplied MIME headers.
- Supported audio formats: `audio/ogg`, `audio/opus`, `audio/mp4`, `audio/mpeg`, `audio/wav`.
- Supported image formats: `image/jpeg`, `image/png`, `image/webp`.

---

## 5. Rate Limiting & Denial of Service Protection
- Redis-backed sliding window / token bucket rate limiter:
  - Per-user message rate limit: e.g., max 10 messages per minute.
  - Per-user tool execution limit: e.g., max 5 tool executions per minute.
- Exceeding the rate limit yields a friendly rate-limit notice without crashing or queue starvation.

---

## 6. Secret Management & Audit Logging
- `.env` is ignored by `.gitignore`.
- Structured logging masks sensitive fields:
  - `apiKey`, `password`, `token`, `secret`, `authorization`, `cookie`.
- Audit logs in PostgreSQL record:
  - Admin operations, tool executions, reminder cancellations, access denials.
