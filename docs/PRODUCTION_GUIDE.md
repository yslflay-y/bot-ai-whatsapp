# Panduan Operasional Produksi: WhatsApp AI Assistant di Linux VPS

Panduan lengkap untuk men-deploy, mengoperasikan, memantau, dan merawat **WhatsApp AI Assistant** di lingkungan Linux VPS (Ubuntu 22.04 / 24.04 LTS).

---

## 1. Prasyarat Server VPS
- **OS**: Ubuntu 22.04 / 24.04 LTS (atau Debian 12)
- **CPU**: Minimal 1 vCPU (direkomendasikan 2 vCPU)
- **RAM**: Minimal 2 GB RAM (direkomendasikan 4 GB dengan swap 2 GB)
- **Storage**: Minimal 20 GB SSD
- **Docker & Docker Compose**: Sudah terpasang

---

## 2. Instalasi & Persiapan Server

### 2.1 Update Sistem & Pasang Docker
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates

# Pasang Docker Engine resmi
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2.2 Konfigurasi Firewall (UFW)
Aplikasi hanya membuka port HTTP untuk observability/health check atau reverse proxy. PostgreSQL dan Redis berada di internal private docker network dan tidak boleh dibuka ke publik:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp # Port health check / metrics (atau batasi ke reverse proxy Nginx)
sudo ufw enable
```

---

## 3. Deployment Aplikasi

### 3.1 Clone Repositori & Salin Konfigurasi
```bash
git clone <URL_REPOSITORI_ANDA> /opt/whatsapp-assistant
cd /opt/whatsapp-assistant

# Buat file .env dari template
cp .env.example .env
nano .env
```

### 3.2 Isi Konfigurasi `.env`
Pastikan Anda mengisi:
- `GEMINI_API_KEY`: Dapatkan dari Google AI Studio.
- `ALLOWLIST_NUMBERS`: Nomor WhatsApp Anda yang diizinkan (format: `6281234567890`).
- `ADMIN_NUMBERS`: Nomor admin (format: `6281234567890`).
- `DEFAULT_TIMEZONE`: `Asia/Jakarta` (atau zona waktu lokal Anda).

### 3.3 Jalankan Layanan dengan Docker Compose
```bash
docker compose up -d --build
```

---

## 4. Pairing WhatsApp Pertama Kali

Saat pertama kali dijalankan, container `app` akan meminta autentikasi WhatsApp melalui QR code di terminal:

```bash
# Buka logs container aplikasi
docker compose logs -f app
```

1. Buka aplikasi **WhatsApp** di smartphone Anda.
2. Buka menu **Titik Tiga / Pengaturan** -> **Perangkat Tertaut** (*Linked Devices*).
3. Pilih **Tautkan Perangkat** (*Link a Device*).
4. Arahkan kamera ke QR code yang muncul di layar terminal.
5. Setelah terhubung, status di log akan menampilkan:
   `WhatsApp socket connected successfully!`

Sesi autentikasi akan tersimpan permanen di volume `assistant_data` (`/app/data/auth`), sehingga setelah reboot server, bot akan otomatis tersambung kembali tanpa perlu scan ulang.

---

## 5. Pemantauan & Observability

Aplikasi menyediakan endpoint HTTP bawaan pada port `3000`:

- **Liveness Probe**:
  ```bash
  curl http://localhost:3000/health
  # Respons: {"status":"healthy","timestamp":"...","uptime":...}
  ```

- **Readiness Probe** (Memeriksa koneksi PostgreSQL, Redis, dan WhatsApp):
  ```bash
  curl http://localhost:3000/ready
  ```

- **Metrik Sistem**:
  ```bash
  curl http://localhost:3000/metrics
  ```

---

## 6. Prosedur Backup & Restore

### 6.1 Melakukan Backup
Jalankan script backup otomatis (akan mem-backup PostgreSQL dump dan kredensial WhatsApp):
```bash
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh
```
File arsip `.tar.gz` akan disimpan di direktori `./backups/`.

### 6.2 Menjadwalkan Backup Harian Otomatis (Cron)
Tambahkan ke crontab server (`crontab -e`):
```cron
0 3 * * * /opt/whatsapp-assistant/scripts/backup.sh >> /var/log/whatsapp_backup.log 2>&1
```

### 6.3 Melakukan Restore
Jika Anda memindahkan bot ke VPS baru:
```bash
./scripts/restore.sh ./backups/20260913_120000.tar.gz
```

---

## 7. Troubleshooting

| Masalah | Solusi |
|---|---|
| Device logged out / QR code loop | Hapus session auth: `docker compose run --rm app rm -rf /app/data/auth/*` lalu restart `docker compose restart app` dan scan ulang QR code. |
| Pesan ditolak / tidak dibalas | Periksa nomor pengirim di `.env` `ALLOWLIST_NUMBERS`. Pastikan format nomor adalah angka internasional tanpa `+` (contoh: `6281234567890`). |
| Database connection error | Pastikan container `postgres` dalam keadaan sehat: `docker compose ps`. Periksa log: `docker compose logs postgres`. |
| Pengingat tidak berbunyi | Pastikan Redis berjalan: `docker compose logs redis`. Periksa apakah zona waktu sudah diatur dengan benar (`DEFAULT_TIMEZONE=Asia/Jakarta`). |
