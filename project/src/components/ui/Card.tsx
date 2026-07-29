import { View, Pressable } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { cardClasses, type CardClassVariant } from '@shared/design/classNames';

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  variant?: CardClassVariant;
}

export function Card({ children, className, onPress, variant = 'default' }: CardProps) {
  const base = cn(cardClasses[variant], onPress && 'active:scale-[0.99]');

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(base, className)}>
        {children}
      </Pressable>
    );
  }
  return <View className={cn(base, className)}>{children}</View>;
}

export function CardBare({ children, className, onPress }: CardProps) {
  const base = cn(cardClasses.bare, onPress && 'active:scale-[0.99]');

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(base, className)}>
        {children}
      </Pressable>
    );
  }
  return <View className={cn(base, className)}>{children}</View>;
}
