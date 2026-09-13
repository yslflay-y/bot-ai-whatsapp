export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly userFacingMessage: string;

  constructor(message: string, userFacingMessage?: string, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    this.userFacingMessage =
      userFacingMessage || "Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Input yang Anda berikan tidak valid. Periksa kembali format pesan Anda."
    );
  }
}

export class AuthorizationError extends AppError {
  public readonly statusCode = 403;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Akses ditolak. Nomor Anda belum terdaftar di sistem asisten ini."
    );
  }
}

export class RateLimitError extends AppError {
  public readonly statusCode = 429;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Anda mengirim pesan terlalu cepat. Mohon tunggu sebentar."
    );
  }
}

export class DatabaseError extends AppError {
  public readonly statusCode = 500;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Gagal memproses data ke database. Silakan coba lagi nanti."
    );
  }
}

export class AIProviderError extends AppError {
  public readonly statusCode = 502;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Layanan AI sedang mengalami gangguan sementara. Mohon coba sesaat lagi."
    );
  }
}

export class WhatsAppError extends AppError {
  public readonly statusCode = 502;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Gagal berinteraksi dengan layanan WhatsApp."
    );
  }
}

export class QueueError extends AppError {
  public readonly statusCode = 500;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Gagal memproses antrean tugas."
    );
  }
}

export class ExternalServiceError extends AppError {
  public readonly statusCode = 502;
  constructor(message: string, userFacingMessage?: string) {
    super(
      message,
      userFacingMessage || "Gagal mengakses layanan eksternal."
    );
  }
}
