import { Pressable, type PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'gold' | 'dark' | 'outline' | 'ghost' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  full?: boolean;
  className?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-ex-red text-white active:bg-ex-redDark active:scale-[0.98] shadow-red',
  gold: 'bg-ex-red text-white font-semibold shadow-red active:bg-ex-redDark active:scale-[0.98]',
  dark: 'bg-ink-900 text-white active:bg-ink-800 active:scale-[0.98]',
  outline: 'border border-ink-200 text-ink-900 bg-white active:border-ink-300 active:bg-ink-50 active:scale-[0.98]',
  ghost: 'text-ink-700 active:bg-ink-100 active:scale-[0.98]',
  subtle: 'bg-ink-100 text-ink-700 active:bg-ink-200 active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2.5 text-xs rounded-xl gap-1.5',
  md: 'px-5 py-3.5 text-sm rounded-2xl gap-2',
  lg: 'px-6 py-4 text-base rounded-2xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'flex flex-row items-center justify-center font-medium active:opacity-90 disabled:opacity-40',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </Pressable>
  );
}
