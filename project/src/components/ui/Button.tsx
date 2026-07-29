import { Pressable, type PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonClasses, type ButtonClassVariant } from '@shared/design/classNames';

type Variant = ButtonClassVariant;
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  full?: boolean;
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
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'flex flex-row items-center justify-center font-medium active:opacity-90 disabled:opacity-40',
        buttonClasses[variant],
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
