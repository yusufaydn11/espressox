export function CrmSkeleton() {
  return (
    <div className="space-y-6 animate-pulse min-w-0">
      <div className="h-8 w-48 bg-ink-100 dark:bg-ink-800 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-ink-100 dark:bg-ink-800 rounded-2xl" />)}
      </div>
      <div className="h-10 w-full bg-ink-100 dark:bg-ink-800 rounded-xl" />
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-ink-100 dark:bg-ink-800 rounded-2xl" />)}
    </div>
  );
}
