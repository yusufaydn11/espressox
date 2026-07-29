import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, Badge, EmptyState } from '../../lib/ui';
import { formatTRY } from '../../lib/utils';

export function SalesTrendChart({ data }: { data: { label: string; value: number }[] }) {
  const safeData = data.length > 0 ? data : [{ label: '—', value: 0 }];
  const hasValues = data.some(d => d.value > 0);

  return (
    <Card className="p-5 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Satış Trendi</h3>
          <p className="text-xs text-ink-400">Son 14 gün — tüm şubeler</p>
        </div>
        {hasValues && <Badge tone="green"><TrendingUp size={11} /> Canlı</Badge>}
      </div>
      {!hasValues ? (
        <EmptyState title="Satış verisi yok" subtitle="Seçili dönemde kayıtlı satış bulunamadı" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={safeData}>
            <defs>
              <linearGradient id="hqSalesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9494A0' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
            />
            <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Area type="monotone" dataKey="value" stroke="#C8102E" strokeWidth={2.5} fill="url(#hqSalesGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
