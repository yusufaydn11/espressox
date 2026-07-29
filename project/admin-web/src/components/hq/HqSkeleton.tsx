export function HqSkeleton() {
  return (
    <div className="space-y-6 animate-pulse min-w-0">
      <div className="h-8 w-56 bg-ink-100 dark:bg-ink-800 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 bg-ink-100 dark:bg-ink-800 rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
        <div className="h-72 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
      </div>
      {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-ink-100 dark:bg-ink-800 rounded-xl" />)}
    </div>
  );
}
