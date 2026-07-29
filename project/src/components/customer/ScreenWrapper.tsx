import { View } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ScreenWidth = 'narrow' | 'default' | 'wide' | 'full';

const WIDTH_CLASS: Record<ScreenWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-5xl',
  full: 'max-w-full',
};

interface ScreenWrapperProps {
  children: ReactNode;
  width?: ScreenWidth;
  className?: string;
  /** Ekstra alt boşluk olmadan sadece yatay hizalama */
  noPadding?: boolean;
}

/** Müşteri ekranları için standart padding + max-width + ortalama */
export function ScreenWrapper({
  children,
  width = 'default',
  className,
  noPadding = false,
}: ScreenWrapperProps) {
  return (
    <View
      className={cn(
        'mx-auto w-full',
        WIDTH_CLASS[width],
        noPadding ? 'px-8' : 'px-8 pt-8 pb-10',
        className,
      )}
    >
      {children}
    </View>
  );
}

export const SCREEN = {
  paddingX: 'px-8',
  paddingTop: 'pt-8',
  paddingBottom: 'pb-10',
  gap: 'gap-6',
  sectionGap: 'mt-6',
} as const;
