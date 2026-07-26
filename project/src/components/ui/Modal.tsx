import { View, Text, Pressable, Modal as RNModal } from 'react-native';
import type { ReactNode } from 'react';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Modal({ open, onClose, children, title, className }: ModalProps) {
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950/30 justify-center items-center p-4">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className={cn(
          'relative w-full max-w-lg bg-white rounded-3xl shadow-premium max-h-[90vh]',
          className,
        )}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-ink-100">
            {title ? <Text className="text-lg font-semibold text-ink-900">{title}</Text> : <View />}
            <Pressable
              onPress={onClose}
              className="h-9 w-9 rounded-full bg-ink-100 items-center justify-center active:bg-ink-200"
            >
              <X size={18} color="#6E6E78" />
            </Pressable>
          </View>
          <View className="p-5">{children}</View>
        </View>
      </View>
    </RNModal>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Sil' }: ConfirmDialogProps) {
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950/40 justify-center items-center p-4">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="relative w-full max-w-sm bg-white rounded-3xl shadow-premium p-6">
          <Text className="text-lg font-semibold text-ink-900">{title}</Text>
          <Text className="text-sm text-ink-500 mt-2">{message}</Text>
          <View className="flex-row gap-3 mt-6">
            <Pressable
              onPress={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-ink-200 items-center active:bg-ink-50"
            >
              <Text className="text-sm font-medium text-ink-600">Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(); onClose(); }}
              className="flex-1 px-4 py-3 rounded-xl bg-ex-red items-center active:bg-ex-redDark"
            >
              <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <View>
      <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</Text>
      {children}
      {hint && <Text className="text-[10px] text-ink-400 mt-1">{hint}</Text>}
    </View>
  );
}

const inputClass = 'w-full px-4 py-3 rounded-xl bg-cream-50 border border-ink-200 text-sm text-ink-900';

import { TextInput as RNTextInput } from 'react-native';

export function TextInput(props: React.ComponentProps<typeof RNTextInput>) {
  return <RNTextInput placeholderTextColor="#9494A0" {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.ComponentProps<typeof RNTextInput>) {
  return <RNTextInput placeholderTextColor="#9494A0" multiline {...props} className={cn(inputClass, props.className)} />;
}

export function Select({ value, onValueChange, options }: {
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <View className={inputClass}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onValueChange(o.value)} className="py-2">
          <Text className={value === o.value ? 'text-ex-red font-semibold' : 'text-ink-700'}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <Pressable onPress={() => onChange(!checked)} className="flex-row items-center gap-2.5">
      <View className={cn('relative h-6 w-11 rounded-full', checked ? 'bg-ex-red' : 'bg-ink-200')}>
        <View className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm', checked && 'translate-x-5')} />
      </View>
      {label && <Text className="text-sm text-ink-700">{label}</Text>}
    </Pressable>
  );
}
