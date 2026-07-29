import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Store, TrendingUp } from 'lucide-react';
import { Card, EmptyState } from '../../lib/ui';
import { formatTRY } from '../../lib/utils';

interface StoreRow {
  label: string;
  value: number;
}

export function StorePerformanceGrid({ stores }: { stores: StoreRow[] }) {
  const ranked = [...stores].sort((a, b) => b.value - a.value);
  const max = ranked.length > 0 ? Math.max(...ranked.map(s => s.value), 1) : 1;

  if (ranked.length === 0) {
    return (
      <div className="space-y-4 min-w-0">
        <div>
          <h3 className="text-base font-bold text-ink-900 dark:text-ink-100 font-display">Şube Performansı</h3>
          <p className="text-xs text-ink-400 mt-0.5">Satış karşılaştırması</p>
        </div>
        <Card className="p-8">
          <EmptyState title="Şube verisi yok" subtitle="Karşılaştırma için yeterli satış kaydı bulunamadı" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h3 className="text-base font-bold text-ink-900 dark:text-ink-100 font-display">Şube Performansı</h3>
        <p className="text-xs text-ink-400 mt-0.5">Satış karşılaştırması ve yoğunluk</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ranked.map((s, i) => {
          const pct = Math.round((s.value / max) * 100);
          return (
            <Card key={s.label} className="p-4 min-w-0">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-ink-900 flex items-center justify-center shrink-0">
                  <Store size={16} className="text-white" />
                </div>
                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide">#{i + 1}</span>
              </div>
              <p className="text-sm font-bold text-ink-900 dark:text-ink-100 truncate">{s.label}</p>
              <p className="text-xl font-bold text-ex-red mt-1 font-display">{formatTRY(s.value)}</p>
              <div className="mt-3 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div className="h-full rounded-full bg-red-gradient transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-ink-400 mt-1.5 flex items-center gap-1">
                <TrendingUp size={10} /> Toplam ciro payı %{pct}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 min-w-0 overflow-x-auto">
        <h4 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Performans Karşılaştırması</h4>
        <ResponsiveContainer width="100%" height={Math.max(240, ranked.length * 36)} minWidth={280}>
          <BarChart data={ranked} layout="vertical" margin={{ left: 10, right: 8 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6E6E78' }} axisLine={false} tickLine={false} width={88} />
            <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Bar dataKey="value" fill="#C8102E" radius={[0, 6, 6, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
