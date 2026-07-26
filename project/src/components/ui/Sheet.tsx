import { View, Text, Pressable, Modal as RNModal, ScrollView } from 'react-native';
import type { ReactNode } from 'react';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Sheet({ open, onClose, children, title, className }: SheetProps) {
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-ink-950/30" onPress={onClose} />
        <View className={cn('relative w-full bg-white rounded-t-[2rem] shadow-premium max-h-[92vh]', className)}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-ink-100">
            <View className="absolute left-1/2 -top-1 -translate-x-1/2 h-1 w-10 rounded-full bg-ink-200" />
            {title ? <Text className="text-lg font-semibold text-ink-900">{title}</Text> : <View />}
            <Pressable
              onPress={onClose}
              className="ml-auto h-9 w-9 rounded-full bg-ink-100 items-center justify-center active:bg-ink-200"
            >
              <X size={18} color="#6E6E78" />
            </Pressable>
          </View>
          <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}
