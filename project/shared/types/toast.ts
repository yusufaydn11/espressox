import type { ToastClassVariant } from '../design/classNames';

export interface ToastMessage {
  message: string;
  variant?: ToastClassVariant;
}

export function normalizeToast(input: string | ToastMessage): ToastMessage {
  return typeof input === 'string' ? { message: input } : input;
}
