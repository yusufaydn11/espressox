import { memo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Card, Badge, EmptyState } from '../../lib/ui';
import { formatTRY, formatNum } from '../../lib/utils';

export const AnalyticsTrendPanel = memo(function AnalyticsTrendPanel({
  data,
  range,
}: {
  data: { label: string; orders: number; revenue: number }[];
  range: number;
}) {
  const hasValues = data.some(d => d.revenue > 0 || d.orders > 0);

  return (
    <Card className="lg:col-span-2 p-5 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş & Ciro Trendi</h3>
          <p className="text-xs text-ink-400">Son {range} gün</p>
        </div>
        {hasValues && <Badge tone="green"><TrendingUp size={11} /> Canlı</Badge>}
      </div>
      {!hasValues ? (
        <EmptyState title="Trend verisi yok" subtitle="Seçili dönemde kayıt bulunamadı" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="hqRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="hqOrdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181B" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#18181B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v / 1000}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} formatter={(v: number, name: string) => name === 'Ciro' ? formatTRY(v) : formatNum(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => v === 'revenue' ? 'Ciro' : 'Sipariş'} />
            <Area yAxisId="left" type="monotone" dataKey="revenue" name="Ciro" stroke="#C8102E" strokeWidth={2.5} fill="url(#hqRevGrad)" />
            <Area yAxisId="right" type="monotone" dataKey="orders" name="Sipariş" stroke="#18181B" strokeWidth={2} fill="url(#hqOrdGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});
