import { Pressable, View, type PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonClasses, type ButtonClassVariant } from '@shared/design/classNames';

type Variant = ButtonClassVariant;
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  /** Full width in a column layout */
  full?: boolean;
  /** Equal flex share inside ButtonRow */
  flex?: boolean;
  className?: string;
}

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2.5 text-xs rounded-xl gap-1.5',
  md: 'px-5 py-3.5 text-sm rounded-2xl gap-2',
  lg: 'px-6 py-4 text-base rounded-2xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  flex,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'flex-row items-center justify-center font-medium active:opacity-90 disabled:opacity-40 shrink-0',
        buttonClasses[variant],
        sizes[size],
        flex && 'flex-1 min-w-0',
        full && !flex && 'w-full self-stretch',
        className,
      )}
      {...props}
    >
      {children}
    </Pressable>
  );
}

/** Horizontal button group — use flex on child buttons, not full */
export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('flex-row items-stretch gap-3', className)}>
      {children}
    </View>
  );
}
