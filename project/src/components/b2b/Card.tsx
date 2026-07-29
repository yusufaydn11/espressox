import { View, Text, Pressable } from 'react-native';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface B2BCardProps {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}

export function B2BCard({ children, onPress, className }: B2BCardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cn('rounded-2xl bg-white border border-ink-100 shadow-card p-4 active:opacity-90', className)}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cn('rounded-2xl bg-white border border-ink-100 shadow-card p-4', className)}>
      {children}
    </View>
  );
}
