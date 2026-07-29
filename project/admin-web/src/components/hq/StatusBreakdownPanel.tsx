import { memo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, EmptyState } from '../../lib/ui';

const PIE_COLORS = ['#C8102E', '#18181B', '#D4AF37', '#3D3D42', '#9494A0', '#E2DFD7'];

export const StatusBreakdownPanel = memo(function StatusBreakdownPanel({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const hasValues = data.some(d => d.value > 0);

  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <PieIcon size={16} className="text-ink-400" />
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş Durumları</h3>
      </div>
      <p className="text-xs text-ink-400 mb-4">Dağılım</p>
      {!hasValues ? (
        <EmptyState title="Durum verisi yok" subtitle="Sipariş kaydı bulunamadı" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});
