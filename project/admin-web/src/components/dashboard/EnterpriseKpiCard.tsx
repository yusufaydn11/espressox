import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'dark' | 'gold' | 'default';

interface EnterpriseKpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  variant?: Variant;
  className?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-br from-ex-red to-[#A00D24] text-white border-transparent shadow-red',
  dark: 'bg-ink-900 text-white border-ink-800 dark:bg-ink-950',
  gold: 'bg-gradient-to-br from-gold-100 to-cream-100 border-gold-200 text-ink-900',
  default: 'bg-white dark:bg-ink-900 border-ink-100 dark:border-ink-800',
};

export function EnterpriseKpiCard({ label, value, sub, icon, variant = 'default', className }: EnterpriseKpiCardProps) {
  const isLight = variant === 'default' || variant === 'gold';

  return (
    <div className={cn('rounded-2xl border p-5 shadow-card transition-shadow hover:shadow-soft min-w-0', variants[variant], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
          variant === 'primary' ? 'bg-white/15' : variant === 'dark' ? 'bg-ink-800' : 'bg-cream-100 dark:bg-ink-800',
        )}>
          {icon}
        </div>
      </div>
      <p className={cn('mt-4 text-2xl font-bold font-display tracking-tight', !isLight && 'text-white')}>{value}</p>
      <p className={cn('text-xs font-semibold uppercase tracking-wide mt-1', isLight ? 'text-ink-500' : 'text-white/80')}>{label}</p>
      {sub && <p className={cn('text-[11px] mt-1.5', isLight ? 'text-ink-400' : 'text-white/60')}>{sub}</p>}
    </div>
  );
}
