import { View } from 'react-native';
import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <View className={cn('rounded-xl bg-ink-100/80', className)} />;
}

export function B2BDashboardSkeleton() {
  return (
    <View className="gap-4">
      <Bone className="h-6 w-48" />
      <View className="flex-row flex-wrap gap-3">
        {[1, 2, 3, 4].map(i => <Bone key={i} className="h-28 flex-1 min-w-[140px] rounded-2xl" />)}
      </View>
      <Bone className="h-52 w-full rounded-2xl" />
      <Bone className="h-40 w-full rounded-2xl" />
    </View>
  );
}

export function B2BListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Bone key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </View>
  );
}

export function B2BProductGridSkeleton() {
  return (
    <View className="gap-3">
      <Bone className="h-10 w-full rounded-xl" />
      <View className="flex-row gap-2">
        {[1, 2, 3].map(i => <Bone key={i} className="h-8 w-16 rounded-lg" />)}
      </View>
      {[1, 2, 3].map(i => <Bone key={i} className="h-36 w-full rounded-2xl" />)}
    </View>
  );
}
