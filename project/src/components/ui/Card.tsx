import { View, Pressable } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, className, onPress }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cn(
          'rounded-2xl bg-white border border-ink-100 shadow-card active:scale-[0.99]',
          className,
        )}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cn('rounded-2xl bg-white border border-ink-100 shadow-card', className)}>
      {children}
    </View>
  );
}

export function CardBare({ children, className, onPress }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cn(
          'rounded-2xl bg-white border border-ink-100 active:scale-[0.99]',
          className,
        )}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cn('rounded-2xl bg-white border border-ink-100', className)}>
      {children}
    </View>
  );
}
