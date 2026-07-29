export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-ink-100 dark:bg-ink-800 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 bg-ink-100 dark:bg-ink-800 rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-80 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
        <div className="h-80 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-ink-100 dark:bg-ink-800 rounded-2xl" />)}
      </div>
    </div>
  );
}
