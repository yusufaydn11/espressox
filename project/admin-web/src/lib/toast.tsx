import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle, X, type LucideIcon } from 'lucide-react';
import { cn } from './utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

const toastConfig: Record<ToastType, { icon: LucideIcon; bg: string; text: string; border: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  error: { icon: XCircle, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  info: { icon: Info, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error = useCallback((m: string) => toast(m, 'error'), [toast]);
  const info = useCallback((m: string) => toast(m, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]">
        {toasts.map(t => {
          const cfg = toastConfig[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lifted animate-fade-up',
                cfg.bg, cfg.text, cfg.border,
              )}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
