import { Text } from 'react-native';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: string;
  className?: string;
}

/** Profil / ayar grupları için küçük uppercase etiket */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <Text className={cn('text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-2.5', className)}>
      {children}
    </Text>
  );
}

/** Form alanları / sheet bölümleri için etiket */
export function FieldLabel({ children, className }: SectionLabelProps) {
  return (
    <Text className={cn('text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2', className)}>
      {children}
    </Text>
  );
}
