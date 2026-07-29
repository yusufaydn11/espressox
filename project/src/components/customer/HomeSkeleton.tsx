import { View } from 'react-native';
import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <View className={cn('rounded-xl bg-ink-100/80', className)} />;
}

export function HomeSkeleton() {
  return (
    <View className="pt-2 pb-10 gap-6">
      <View className="gap-2">
        <Bone className="h-4 w-24" />
        <Bone className="h-10 w-48" />
      </View>
      <View className="flex-row gap-5">
        <Bone className="h-52 flex-1 rounded-[1.25rem]" />
        <View className="gap-3 w-48">
          <Bone className="h-20 rounded-2xl" />
          <Bone className="h-20 rounded-2xl" />
          <Bone className="h-20 rounded-2xl" />
        </View>
      </View>
      <Bone className="h-16 w-full rounded-2xl" />
      <View className="gap-3">
        <Bone className="h-6 w-32" />
        <View className="flex-row gap-4">
          <Bone className="h-44 w-40 rounded-[1.25rem]" />
          <Bone className="h-44 w-40 rounded-[1.25rem]" />
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
