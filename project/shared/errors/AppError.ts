/**
 * Espresso X V2 — unified application errors (user-facing + logging)
 */

export type AppErrorCode =
  | 'unknown'
  | 'network'
  | 'unauthenticated'
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'rate_limited'
  | 'server';

const USER_MESSAGES_TR: Record<AppErrorCode, string> = {
  unknown: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  network: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.',
  unauthenticated: 'Oturum açmanız gerekiyor.',
  unauthorized: 'Bu işlem için yetkiniz yok.',
  validation: 'Girdiğiniz bilgileri kontrol edin.',
  not_found: 'Aradığınız kayıt bulunamadı.',
  rate_limited: 'Çok fazla deneme. Lütfen bir süre bekleyin.',
  server: 'Sunucu hatası. Daha sonra tekrar deneyin.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message?: string, cause?: unknown) {
    const userMessage = USER_MESSAGES_TR[code];
    super(message ?? userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = message ?? userMessage;
    this.cause = cause;
  }

  static fromUnknown(err: unknown, fallback: AppErrorCode = 'unknown'): AppError {
    if (err instanceof AppError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/jwt|unauthenticated|session/i.test(msg)) {
      return new AppError('unauthenticated', undefined, err);
    }
    if (/permission|unauthorized|forbidden/i.test(msg)) {
      return new AppError('unauthorized', undefined, err);
    }
    if (/network|fetch failed|timeout/i.test(msg)) {
      return new AppError('network', undefined, err);
    }
    return new AppError(fallback, msg, err);
  }
}

/** Map Supabase RPC `error` field codes to user messages (loyalty, orders, B2B) */
export function rpcErrorMessage(code: string | null | undefined, labels?: Record<string, string>): string {
  if (!code) return USER_MESSAGES_TR.unknown;
  if (labels?.[code]) return labels[code];
  return code.replace(/_/g, ' ');
}
