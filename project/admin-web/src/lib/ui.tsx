import { type ReactNode, type ButtonHTMLAttributes, useState, type ReactNode as TReactNode } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { cn } from './utils';

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('admin-card', onClick && 'cursor-pointer', className)}>
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'gold';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
}

const variantCls: Record<BtnVariant, string> = {
  primary: 'bg-ex-red text-white hover:bg-ex-redDark shadow-red',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white',
  outline: 'border border-ink-200 text-ink-900 bg-white hover:bg-cream-50 dark:bg-ink-800 dark:border-ink-700 dark:text-ink-100 dark:hover:bg-ink-700',
  ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  danger: 'bg-red-50 text-ex-red hover:bg-red-100 dark:bg-red-950 dark:text-red-400',
  gold: 'bg-gold-gradient text-white shadow-soft',
};
const sizeCls: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', full, className, children, ...props }: BtnProps) {
  return (
    <button className={cn('admin-btn', variantCls[variant], sizeCls[size], full && 'w-full', className)} {...props}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'red' | 'green' | 'gold' | 'dark' | 'amber' | 'blue'; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    red: 'bg-ex-100 text-ex-red dark:bg-red-950 dark:text-red-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
    gold: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    dark: 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  };
  return <span className={cn('badge', tones[tone], className)}>{children}</span>;
}

export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-white dark:bg-ink-900 rounded-2xl shadow-premium animate-scale-in max-h-[90vh] flex flex-col', sizes[size])}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 shrink-0">
          <h3 className="text-base font-bold text-ink-900 dark:text-ink-100">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: ReactNode; accent?: boolean }) {
  return (
    <Card className={cn('p-5', accent && 'border-ex-red/20')}>
      <div className="flex items-start justify-between">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', accent ? 'bg-ex-red/10' : 'bg-cream-100 dark:bg-ink-800')}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold text-ink-900 dark:text-ink-100 font-display tracking-tight">{value}</p>
      <p className="text-xs text-ink-400 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-ink-400 mt-1.5">{sub}</p>}
    </Card>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-8 w-8 rounded-full border-2 border-ink-200 border-t-ex-red animate-spin dark:border-ink-700" />
      {label && <p className="text-sm text-ink-400 mt-3">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-5">
      <div className="h-12 w-12 rounded-2xl bg-ex-100 dark:bg-red-950 flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8102E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      </div>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200 text-center">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Tekrar dene</Button>}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-5">
      <div className="h-12 w-12 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mb-3">
        <Inbox size={22} className="text-ink-400" />
      </div>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{title}</p>
      {subtitle && <p className="text-xs text-ink-400 mt-1 max-w-xs text-center">{subtitle}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── SearchInput ──────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Ara…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-input pl-10 w-full sm:w-64"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────
export function Pagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
      <p className="text-xs text-ink-400">
        Sayfa {page} / {pageCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} />
        </button>
        {start > 1 && (
          <button onClick={() => onPageChange(1)} className="h-8 px-2.5 rounded-lg text-xs font-medium text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">1</button>
        )}
        {start > 2 && <span className="px-1 text-ink-400 text-xs">…</span>}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'h-8 w-8 rounded-lg text-xs font-bold transition-all',
              p === page ? 'bg-ex-red text-white shadow-red' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800',
            )}
          >
            {p}
          </button>
        ))}
        {end < pageCount - 1 && <span className="px-1 text-ink-400 text-xs">…</span>}
        {end < pageCount && (
          <button onClick={() => onPageChange(pageCount)} className="h-8 px-2.5 rounded-lg text-xs font-medium text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">{pageCount}</button>
        )}
        <button
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── FilterChips ──────────────────────────────────────────────
export function FilterChips<T extends string>({ options, value, onChange, labels }: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium transition-all',
            value === opt
              ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
              : 'bg-white border border-ink-100 text-ink-500 hover:bg-cream-50 dark:bg-ink-800 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-700',
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ink-600 dark:text-ink-300">{message}</p>
      <div className="flex gap-2 mt-5 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
        <Button variant="danger" size="sm" onClick={() => { onConfirm(); onClose(); }}>Sil</Button>
      </div>
    </Modal>
  );
}

export type { TReactNode };
