import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, View, Text, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';
import { buttonClasses, type ButtonClassVariant } from '@shared/design/classNames';

type Variant = ButtonClassVariant;
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  /** Full width in a column layout */
  full?: boolean;
  /** Equal flex share inside ButtonRow */
  flex?: boolean;
  className?: string;
}

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2.5 text-xs rounded-xl gap-1.5',
  md: 'px-5 py-3.5 text-sm rounded-2xl gap-2',
  lg: 'px-6 py-4 text-base rounded-2xl gap-2.5',
};

const labelSizes: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const labelColors: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink-800',
  gold: 'text-white',
  dark: 'text-white',
  outline: 'text-ink-800',
  ghost: 'text-ink-500',
  subtle: 'text-ink-600',
  danger: 'text-white',
};

function wrapButtonChildren(children: ReactNode, labelClassName: string): ReactNode {
  return Children.map(Children.toArray(children), (child, index) => {
    if (child == null || typeof child === 'boolean') return null;

    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text key={`btn-label-${index}`} className={labelClassName}>
          {String(child)}
        </Text>
      );
    }

    if (isValidElement(child) && child.type === Fragment) {
      return (
        <Fragment key={`btn-frag-${index}`}>
          {wrapButtonChildren(child.props.children, labelClassName)}
        </Fragment>
      );
    }

    return child;
  });
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  flex,
  className,
  children,
  ...props
}: ButtonProps) {
  const labelClassName = cn('font-medium', labelSizes[size], labelColors[variant]);

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'flex-row items-center justify-center font-medium active:opacity-90 disabled:opacity-40 shrink-0',
        buttonClasses[variant],
        sizes[size],
        flex && 'flex-1 min-w-0',
        full && !flex && 'w-full self-stretch',
        className,
      )}
      {...props}
    >
      {wrapButtonChildren(children, labelClassName)}
    </Pressable>
  );
}

/** Horizontal button group — use flex on child buttons, not full */
export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('flex-row items-stretch gap-3', className)}>
      {children}
    </View>
  );
}
