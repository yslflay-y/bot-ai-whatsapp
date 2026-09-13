# WhatsApp AI Assistant (Production-Ready)

Personal WhatsApp AI Assistant yang siap pakai di lingkungan produksi (Linux VPS) secara mandiri (*self-hosted*), tangguh, aman, dan modular.

---

## ✨ Fitur Utama

- 🧠 **AI Percakapan Cerdas**: Didukung oleh Google Gemini (mendukung multimodal gambar dan pesan suara) dengan sistem cadangan (OpenAI / Groq).
- 💾 **Memori Jangka Panjang (Long-Term Memory)**: Menyimpan preferensi dan instruksi penting pengguna secara eksplisit dan permanen terpisah dari riwayat obrolan biasa.
- 📝 **Sistem Catatan Terstruktur**: Menyimpan ide dan catatan baik melalui bahasa alami (*"Catat: ..."*) maupun perintah cepat (`/note`).
- ⏰ **Pengingat Persisten (Reminders)**: Pengingat satu kali maupun berulang (*cron*), sadar zona waktu (*timezone-aware*), didukung oleh PostgreSQL + Redis BullMQ yang tahan restart VPS/container.
- 🛡️ **Keamanan Berlapis & Anti-SSRF**: Pengecekan allowlist nomor telepon di edge, proteksi ketat SSRF untuk fitur peringkas tautan web (`summarize_url`), dan deduplikasi pesan ganda (*idempotency*).
- 📊 **Monitoring Server Aman**: Alat inspeksi status performa server (CPU, RAM, Uptime) khusus Administrator tanpa membuka shell terminal ke AI.
- 🐳 **Docker & CI/CD Siap Pakai**: Multi-stage Dockerfile, Docker Compose dengan private bridge network, volume persisten, dan prosedur backup/restore otomatis.

---

## 📁 Struktur Proyek

```
├── docs/
│   ├── PROJECT_SPEC.md       # Spesifikasi fungsional dan teknis
│   ├── ARCHITECTURE.md       # Arsitektur sistem dan diagram aliran data
│   ├── SECURITY.md           # Model ancaman dan kebijakan keamanan
│   ├── ROADMAP.md            # Roadmap tahapan pengembangan
│   └── PRODUCTION_GUIDE.md   # Panduan deployment di Linux VPS
├── prisma/
│   ├── schema.prisma         # Skema relational PostgreSQL (12 model)
│   └── migrations/           # Riwayat migrasi database versi resmi
├── src/
│   ├── app/                  # Inisialisasi aplikasi, server Fastify, config & DI
│   ├── modules/
│   │   ├── ai/               # Abstraksi AI provider (Gemini, OpenAI, fallback)
│   │   ├── memory/           # Layanan memori jangka panjang
│   │   ├── messaging/        # Pipeline pesan, deduplikasi & idempotensi
│   │   ├── notes/            # Layanan pencatatan
│   │   ├── permissions/      # Layanan access control & allowlist
│   │   ├── reminders/        # Layanan pengingat & worker BullMQ
│   │   ├── tools/            # Registri alat (Tool Registry) & proteksi SSRF
│   │   └── whatsapp/         # Adapter WhatsApp Baileys (isolated)
│   ├── infrastructure/       # Database (Prisma), Redis, BullMQ, Logger (Pino)
│   ├── shared/               # Typed errors, utility fungsi normalisasi telepon
│   └── main.ts               # Titik masuk utama dan penanganan shutdown sinyal OS
├── tests/
│   └── unit/                 # Rangkaian pengujian unit test otomatis
├── scripts/
│   ├── backup.sh             # Skrip backup database dan auth WhatsApp
│   └── restore.sh            # Skrip restore sistem
├── Dockerfile                # Multi-stage production build dengan non-root user
└── docker-compose.yml        # Orchestration PostgreSQL, Redis, dan App
```

---

## 🚀 Memulai Cepat

1. **Salin environment configuration**:
   ```bash
   cp .env.example .env
   ```
2. **Isi API Key & Nomor Anda di `.env`**:
   - `GEMINI_API_KEY`: API Key Gemini dari Google AI Studio.
   - `ALLOWLIST_NUMBERS`: Nomor WhatsApp Anda (contoh: `6281234567890`).
   - `ADMIN_NUMBERS`: Nomor WhatsApp admin (contoh: `6281234567890`).
3. **Jalankan dengan Docker Compose**:
   ```bash
   docker compose up -d --build
   ```
4. **Scan QR Code WhatsApp**:
   ```bash
   docker compose logs -f app
   ```

Untuk panduan deployment lengkap pada Linux VPS, baca [docs/PRODUCTION_GUIDE.md](file:///c:/Users/ysl/Documents/ALL%20WEB/BOT%20AI%20WA/docs/PRODUCTION_GUIDE.md).

---

## 🧪 Menjalankan Pengujian

```bash
# Menjalankan unit test
pnpm test

# Menjalankan typecheck
pnpm run typecheck

# Menjalankan kompilasi produksi
pnpm run build
```
