import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

type Animation = 'fade-up' | 'fade-in' | 'scale-in' | 'scale-spring' | 'fade-down' | 'slide-up';

interface AnimatedBlockProps extends ViewProps {
  animation?: Animation;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function AnimatedBlock({
  animation = 'fade-up',
  delay = 0,
  className,
  children,
  style,
  ...props
}: AnimatedBlockProps) {
  return (
    <View
      className={cn(
        `animate-${animation} opacity-0 [animation-fill-mode:forwards]`,
        delay > 0 && `[animation-delay:${delay}ms]`,
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}
