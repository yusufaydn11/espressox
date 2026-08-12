import type { ReactNode } from 'react';
import { View } from 'react-native';

interface ThemeCanvasProps {
  children: ReactNode;
  className?: string;
}

/** Ana içerik alanı — krem zemin + dekoratif kırmızı lekeler */
export function ThemeCanvas({ children, className }: ThemeCanvasProps) {
  return (
    <View className={`flex-1 relative overflow-hidden bg-cream-50 ${className ?? ''}`}>
      <View
        className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-ex-red/[0.04]"
        style={{ pointerEvents: 'none' }}
      />
      <View
        className="absolute top-1/3 -left-32 h-64 w-64 rounded-full bg-ex-red/[0.03]"
        style={{ pointerEvents: 'none' }}
      />
      <View
        className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-espresso-200/20"
        style={{ pointerEvents: 'none' }}
      />
      {children}
    </View>
  );
}
