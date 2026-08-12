import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  View, Text, Pressable, Modal as RNModal, Platform, ScrollView,
  TextInput as RNTextInput, StyleSheet,
} from 'react-native';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

const webOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 99998,
} as const;

const modalStyles = StyleSheet.create({
  panel: {
    zIndex: 99999,
    elevation: 24,
    maxHeight: '90%',
  },
});

function ModalPanel({ onClose, children, title, className }: Omit<ModalProps, 'open'>) {
  return (
    <View
      className={cn(
        'relative w-full max-w-lg bg-white rounded-3xl shadow-premium',
        className,
      )}
      style={modalStyles.panel}
    >
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
  );
}

function WebModal({ open, onClose, children, title, className }: ModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <View
      // @ts-expect-error RN Web supports fixed positioning for full-screen overlays
      style={webOverlayStyle}
      className="justify-center items-center p-4 bg-ink-950/30"
    >
      <ModalPanel onClose={onClose} title={title} className={className}>
        {children}
      </ModalPanel>
    </View>,
    document.body,
  );
}

export function Modal({ open, onClose, children, title, className }: ModalProps) {
  if (Platform.OS === 'web') {
    return (
      <WebModal open={open} onClose={onClose} title={title} className={className}>
        {children}
      </WebModal>
    );
  }

  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center p-4 bg-ink-950/30">
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />
        <ModalPanel onClose={onClose} title={title} className={className}>
          {children}
        </ModalPanel>
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

function ConfirmPanel({
  onClose, onConfirm, title, message, confirmLabel = 'Sil',
}: Omit<ConfirmDialogProps, 'open'>) {
  return (
    <View className="relative w-full max-w-sm bg-white rounded-3xl shadow-premium p-6" style={modalStyles.panel}>
      <Text className="text-lg font-semibold text-ink-900">{title}</Text>
      <Text className="text-sm text-ink-500 mt-2">{message}</Text>
      <View className="flex-row items-stretch gap-3 mt-6">
        <Pressable
          onPress={onClose}
          className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-ink-200 items-center justify-center active:bg-ink-50"
        >
          <Text className="text-sm font-medium text-ink-600">Vazgeç</Text>
        </Pressable>
        <Pressable
          onPress={() => { onConfirm(); onClose(); }}
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-ex-red items-center justify-center active:bg-ex-redDark"
        >
          <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Sil' }: ConfirmDialogProps) {
  if (Platform.OS === 'web') {
    if (!open || typeof document === 'undefined') return null;
    return createPortal(
      <View
        // @ts-expect-error RN Web supports fixed positioning for full-screen overlays
        style={webOverlayStyle}
        className="justify-center items-center p-4 bg-ink-950/40"
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <ConfirmPanel
          onClose={onClose}
          onConfirm={onConfirm}
          title={title}
          message={message}
          confirmLabel={confirmLabel}
        />
      </View>,
      document.body,
    );
  }

  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center p-4 bg-ink-950/40">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <ConfirmPanel
          onClose={onClose}
          onConfirm={onConfirm}
          title={title}
          message={message}
          confirmLabel={confirmLabel}
        />
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

type TextInputProps = ComponentProps<typeof RNTextInput>;

export function TextInput(props: TextInputProps) {
  const { style, className, ...rest } = props;
  return (
    <RNTextInput
      placeholderTextColor="#9494A0"
      {...rest}
      className={cn(inputClass, className)}
      style={[
        Platform.OS === 'web'
          // @ts-expect-error RN Web outlineStyle
          ? { outlineStyle: 'none', color: '#1A1A1F', fontSize: 14 }
          : { color: '#1A1A1F' },
        style,
      ]}
    />
  );
}

export function TextArea(props: TextInputProps) {
  return <TextInput {...props} multiline />;
}

export function Select({ value, onValueChange, options }: {
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string; disabled?: boolean }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find(o => o.value === value);
  const selectable = options.filter(o => !o.disabled);

  if (Platform.OS === 'web') {
    return (
      <View className={inputClass}>
        <select
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            color: '#1A1A1F',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {options.length === 0 ? (
            <option value="">Şube bulunamadı</option>
          ) : (
            <>
              <option value="" disabled={!!value}>
                Şube seçin
              </option>
              {options.map(o => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </>
          )}
        </select>
      </View>
    );
  }

  return (
    <View style={{ zIndex: expanded ? 50 : 1 }}>
      <Pressable
        onPress={() => setExpanded(v => !v)}
        className={cn(inputClass, 'flex-row items-center justify-between')}
        accessibilityRole="button"
        accessibilityLabel="Şube seç"
      >
        <Text className={cn('text-sm flex-1', selected ? 'text-ink-900' : 'text-ink-400')}>
          {selected?.label ?? (selectable.length === 0 ? 'Şube bulunamadı' : 'Şube seçin')}
        </Text>
        <ChevronDown size={16} color="#9494A0" />
      </Pressable>
      {expanded && (
        <View
          className="mt-1 rounded-xl border border-ink-200 bg-white max-h-48"
          style={{ elevation: 8, zIndex: 50 }}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {selectable.length === 0 ? (
              <Text className="text-sm text-ink-400 p-3">Atanabilir şube yok</Text>
            ) : (
              selectable.map(o => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onValueChange(o.value);
                    setExpanded(false);
                  }}
                  className={cn('px-4 py-3 border-b border-ink-100', value === o.value && 'bg-ex-red/5')}
                >
                  <Text className={value === o.value ? 'text-ex-red font-semibold text-sm' : 'text-ink-700 text-sm'}>
                    {o.label}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}
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
