import { Card } from '../../lib/ui';
import { CrmKpiGrid } from './CrmKpiGrid';
import type { CrmSummary } from '../../hooks/useCrmCustomers';

function TierBreakdownPanel({ tiers }: { tiers: { label: string; value: number }[] }) {
  if (tiers.length === 0) return null;
  const max = Math.max(...tiers.map(t => t.value), 1);

  return (
    <Card className="p-5 min-w-0">
      <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Segment Dağılımı</h3>
      <div className="space-y-3">
        {tiers.map(t => (
          <div key={t.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-ink-700 dark:text-ink-300">{t.label}</span>
              <span className="text-ink-400">{t.value}</span>
            </div>
            <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
              <div className="h-full rounded-full bg-red-gradient" style={{ width: `${Math.round((t.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CrmDashboardPanels({ summary }: { summary: CrmSummary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <CrmKpiGrid summary={summary} />
      </div>
      <TierBreakdownPanel tiers={summary.tierBreakdown} />
    </div>
  );
}
