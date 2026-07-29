import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface B2BPaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}

export function B2BPagination({ page, pageCount, onPageChange }: B2BPaginationProps) {
  if (pageCount <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <View className="flex-row items-center justify-between mt-4">
      <Text className="text-xs text-ink-400">Sayfa {page} / {pageCount}</Text>
      <View className="flex-row items-center gap-1">
        <Pressable
          disabled={page === 1}
          onPress={() => onPageChange(page - 1)}
          className="h-8 w-8 rounded-lg items-center justify-center disabled:opacity-30"
        >
          <ChevronLeft size={16} color="#6E6E78" />
        </Pressable>
        {pages.map(p => (
          <Pressable
            key={p}
            onPress={() => onPageChange(p)}
            className={cn(
              'h-8 w-8 rounded-lg items-center justify-center',
              p === page ? 'bg-ex-red' : 'bg-ink-50',
            )}
          >
            <Text className={cn('text-xs font-bold', p === page ? 'text-white' : 'text-ink-500')}>{p}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={page === pageCount}
          onPress={() => onPageChange(page + 1)}
          className="h-8 w-8 rounded-lg items-center justify-center disabled:opacity-30"
        >
          <ChevronRight size={16} color="#6E6E78" />
        </Pressable>
      </View>
    </View>
  );
}
