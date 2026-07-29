import { View } from 'react-native';
import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <View className={cn('rounded-xl bg-ink-100/80', className)} />;
}

export function HomeSkeleton() {
  return (
    <View className="mx-auto max-w-md pb-32 w-full px-5 pt-5 gap-5">
      <View className="gap-2">
        <Bone className="h-4 w-24" />
        <Bone className="h-9 w-48" />
      </View>
      <Bone className="h-44 w-full rounded-3xl" />
      <View className="flex-row gap-3">
        <Bone className="h-28 flex-1 rounded-2xl" />
        <Bone className="h-28 flex-1 rounded-2xl" />
      </View>
      <Bone className="h-16 w-full rounded-2xl" />
      <View className="gap-3 mt-2">
        <Bone className="h-6 w-32" />
        <View className="flex-row gap-3">
          <Bone className="h-44 w-40 rounded-3xl" />
          <Bone className="h-44 w-40 rounded-3xl" />
        </View>
      </View>
    </View>
  );
}

export function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View className="gap-3">
      <Bone className="h-6 w-36" />
      {Array.from({ length: rows }).map((_, i) => (
        <Bone key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </View>
  );
}
