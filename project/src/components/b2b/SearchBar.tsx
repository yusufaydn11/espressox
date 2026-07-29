import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react';

interface B2BSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function B2BSearchBar({ value, onChange, placeholder = 'Ara…' }: B2BSearchBarProps) {
  return (
    <View className="flex-row items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-ink-200">
      <Search size={16} color="#9494A0" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        className="flex-1 text-sm text-ink-900"
        placeholderTextColor="#9494A0"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')}>
          <X size={15} color="#9494A0" />
        </Pressable>
      )}
    </View>
  );
}
