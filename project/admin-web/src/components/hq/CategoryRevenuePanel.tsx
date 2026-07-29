import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, EmptyState } from '../../lib/ui';
import { formatTRY } from '../../lib/utils';

export const CategoryRevenuePanel = memo(function CategoryRevenuePanel({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const hasValues = data.some(d => d.value > 0);

  return (
    <Card className="p-5 min-w-0">
      <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Kategori Bazlı Ciro</h3>
      {!hasValues ? (
        <EmptyState title="Kategori verisi yok" subtitle="Ciro kaydı bulunamadı" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v / 1000}k`} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6E6E78' }} axisLine={false} tickLine={false} width={80} />
            <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Bar dataKey="value" fill="#C8102E" radius={[0, 6, 6, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});
