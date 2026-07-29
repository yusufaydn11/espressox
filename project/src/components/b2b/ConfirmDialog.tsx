import { View, Text, Pressable, Modal } from 'react-native';

interface B2BConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}

export function B2BConfirmDialog({
  open, title, message, confirmLabel = 'Onayla', cancelLabel = 'Vazgeç',
  onConfirm, onClose, danger = true,
}: B2BConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-6 bg-ink-950/40">
        <View className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-premium">
          <Text className="text-base font-bold text-ink-900 mb-2">{title}</Text>
          <Text className="text-sm text-ink-500 mb-4">{message}</Text>
          <View className="flex-row gap-2 justify-end">
            <Pressable onPress={onClose} className="px-4 py-2 rounded-xl bg-ink-50">
              <Text className="text-sm font-medium text-ink-600">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(); onClose(); }}
              className={danger ? 'px-4 py-2 rounded-xl bg-ex-red' : 'px-4 py-2 rounded-xl bg-ink-900'}
            >
              <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
