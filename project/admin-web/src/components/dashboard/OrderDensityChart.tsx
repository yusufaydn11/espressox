import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, EmptyState } from '../../lib/ui';

export function OrderDensityChart({ data }: { data: { hour: string; orders: number }[] }) {
  const chartData = data.length > 0 ? data.filter((_, i) => i % 2 === 0) : [{ hour: '—', orders: 0 }];
  const peakEntry = data.length > 0
    ? data.reduce((best, d) => (d.orders > best.orders ? d : best), data[0])
    : null;
  const peak = peakEntry?.orders ?? 0;
  const hasValues = data.some(d => d.orders > 0);

  return (
    <Card className="p-5 min-w-0 overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş Yoğunluğu</h3>
        <p className="text-xs text-ink-400">Saatlik dağılım — bugün</p>
      </div>
      {!hasValues ? (
        <EmptyState title="Yoğunluk verisi yok" subtitle="Bugün için sipariş kaydı bulunamadı" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="orders" fill="#18181B" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-ink-400 mt-2 text-center">
            En yoğun saat: {peakEntry?.hour ?? '—'} ({peak} sipariş)
          </p>
        </>
      )}
    </Card>
  );
}
