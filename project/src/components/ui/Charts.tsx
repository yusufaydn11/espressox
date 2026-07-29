import { View, Text } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { ChartPoint } from '@/types';
import { cn } from '@/lib/utils';

interface BarChartProps {
  data: ChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}

export function BarChart({ data, color = '#C8102E', height = 140, formatValue: _formatValue = (n) => `${n}` }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <View className="flex-row items-end justify-between gap-2" style={{ height }}>
      {data.map((d) => {
        const h = (d.value / max) * 100;
        return (
          <View key={d.label} className="flex-1 flex-col items-center justify-end gap-2">
            <View className="w-full flex-col justify-end items-center" style={{ height: height - 24 }}>
              <View
                className="w-full rounded-t-lg"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                }}
              />
            </View>
            <Text className="text-[10px] text-ink-400">{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

interface DonutChartProps {
  data: ChartPoint[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = ['#C8102E', '#18181B', '#9494A0', '#C4C4CC', '#E0E0E4', '#EFEFF1'];
  let offset = 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  return (
    <View className="flex-row items-center gap-6">
      <View className="relative" style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 160 160">
          {data.map((d, i) => {
            const pct = d.value / total;
            const dash = pct * circumference;
            const seg = (
              <Circle
                key={d.label}
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="18"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                rotation="-90"
                origin="80,80"
              />
            );
            offset += dash;
            return seg;
          })}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-2xl font-bold text-ink-900">{total > 1000 ? `${(total / 1000).toFixed(1)}k` : total}</Text>
          <Text className="text-[9px] text-ink-400">toplam</Text>
        </View>
      </View>
      <View className="gap-2 flex-1">
        {data.map((d, i) => (
          <View key={d.label} className="flex-row items-center gap-2">
            <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <Text className="text-xs text-ink-600 flex-1">{d.label}</Text>
            <Text className="text-xs font-semibold text-ink-900">{Math.round((d.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface LineChartProps {
  data: ChartPoint[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 160, color = '#C8102E' }: LineChartProps) {
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const width = 100;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 20 - ((d.value - min) / range) * (height - 40);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${width} ${height - 20} L 0 ${height - 20} Z`;

  return (
    <View className="relative" style={{ height }}>
      <Svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height}>
        <Defs>
          <LinearGradient id="linefill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#linefill)" />
        <Path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View className="flex-row justify-between mt-1">
        {data.map(d => (
          <Text key={d.label} className="text-[10px] text-ink-400">{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, positive = true, icon }: StatCardProps) {
  return (
    <View className="p-5 rounded-2xl bg-white border border-ink-100 shadow-card">
      <View className="flex-row items-start justify-between mb-3">
        {icon && <View className="h-10 w-10 rounded-xl bg-red-50 items-center justify-center">{icon}</View>}
        {change && (
          <Text className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-ex-red',
          )}>{change}</Text>
        )}
      </View>
      <Text className="text-2xl font-bold text-ink-900 leading-none">{value}</Text>
      <Text className="text-xs text-ink-400 mt-1.5">{label}</Text>
    </View>
  );
}
