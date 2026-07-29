import { View, Text, Pressable, Modal as RNModal, ScrollView } from 'react-native';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  /** Varsayılan p-6 padding'i kapat — ProductDetail gibi */
  flush?: boolean;
}

export function Sheet({ open, onClose, children, title, className, flush = false }: SheetProps) {
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-ink-950/40" onPress={onClose} />
        <View className={cn(
          'relative w-full max-w-2xl self-center bg-white rounded-t-[2rem] shadow-premium max-h-[92vh] border-t border-cream-200',
          className,
        )}>
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-cream-100">
            <View className="absolute left-1/2 -top-1 -translate-x-1/2 h-1 w-10 rounded-full bg-cream-300" />
            {title ? (
              <Text className="text-lg font-bold text-ink-900 font-display">{title}</Text>
            ) : (
              <View />
            )}
            <Pressable
              onPress={onClose}
              className="ml-auto h-9 w-9 rounded-full bg-cream-50 border border-cream-200 items-center justify-center active:bg-cream-100"
            >
              <X size={18} color={colors.ink[500]} />
            </Pressable>
          </View>
          <ScrollView
            className={flush ? '' : 'px-6 py-5'}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}
