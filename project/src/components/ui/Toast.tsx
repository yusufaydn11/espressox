import { View, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastClasses, type ToastClassVariant } from '@shared/design/classNames';
import { toastVariants } from '@shared/design/componentVariants';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: CheckCircle2,
} as const;

const textClasses: Record<ToastClassVariant, string> = {
  default: 'text-white',
  success: 'text-semantic-success',
  error: 'text-semantic-error',
  warning: 'text-semantic-warning',
  info: 'text-semantic-info',
};

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  const variant: ToastClassVariant = toast.variant ?? 'default';
  const Icon = icons[variant];
  const iconColor =
    variant === 'default'
      ? '#E11D38'
      : toastVariants[variant as keyof typeof toastVariants]?.text ?? '#FFFFFF';

  return (
    <View className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[60] animate-fade-up">
      <View
        className={cn(
          'flex-row items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-premium max-w-[90vw]',
          toastClasses[variant],
        )}
      >
        <Icon size={18} color={iconColor} />
        <Text className={cn('text-sm font-medium flex-shrink', textClasses[variant])}>
          {toast.message}
        </Text>
      </View>
    </View>
  );
}
