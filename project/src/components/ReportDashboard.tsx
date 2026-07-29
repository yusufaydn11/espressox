import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView,
} from 'react-native';
import {
  Coffee, Gift, Award, TrendingUp, TrendingDown, Users, AlertTriangle, Clock, Activity, Store as StoreIcon, Crown, ChevronDown,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { BarChart, LineChart, StatCard } from '@/components/ui/Charts';
import { cn } from '@/lib/utils';
import {
  fetchAnalytics, presetRange,
  type AnalyticsResponse, type DatePreset,
} from '@/lib/franchise-analytics';

interface ReportDashboardProps {
  scope: 'hq' | 'store';
  storeId?: string | null;
  title: string;
  subtitle: string;
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Haftalık' },
  { id: 'month', label: 'Aylık' },
  { id: 'year', label: 'Yıllık' },
];

export function ReportDashboard({ scope, storeId, title, subtitle }: ReportDashboardProps) {
  const [preset, setPreset] = useState<DatePreset>('month');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'freecoffee' | 'suspicious' | 'leaderboard'>('overview');
  const [presetOpen, setPresetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = presetRange(preset);
      const res = await fetchAnalytics({
        scope,
        storeId: storeId ?? undefined,
        start: range.start,
        end: range.end,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [scope, storeId, preset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Raporlar yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState title="Veri bulunamadı" />;

  const s = data.summary;
  const timeSeriesData = data.timeSeries.map(t => ({ label: t.date.slice(5), value: t.freeCoffees }));
  const stampSeriesData = data.timeSeries.map(t => ({ label: t.date.slice(5), value: t.stampCards }));
  const productChartData = data.freeCoffeeByProduct.slice(0, 6).map(p => ({ label: p.name, value: p.count }));
  const storeChart = data.storeComparison.slice(0, 8).map(r => ({ label: r.storeName.split(' ')[0], value: r.freeCoffees }));
  const revenueChart = data.storeComparison.slice(0, 8).map(r => ({ label: r.storeName.split(' ')[0], value: Math.round(r.revenue) }));

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-8 gap-5 pt-4">
      <View className="flex-col gap-3">
        <View>
          <Text className="text-lg font-bold text-ink-900">{title}</Text>
          <Text className="text-sm text-ink-400 mt-0.5">{subtitle}</Text>
        </View>
        <View className="flex-row gap-2 items-center">
          <Pressable
            onPress={() => setPresetOpen(v => !v)}
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-100 active:bg-ink-200"
          >
            <Text className="text-xs font-medium text-ink-700">{PRESETS.find(p => p.id === preset)?.label}</Text>
            <ChevronDown size={14} color="#6E6E78" />
          </Pressable>
          {presetOpen && (
            <View className="flex-row gap-1 flex-1">
              {PRESETS.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => { setPreset(p.id); setPresetOpen(false); }}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium',
                    preset === p.id ? 'bg-white text-ink-900 shadow-card' : 'bg-ink-50 text-ink-500',
                  )}
                >
                  <Text className={preset === p.id ? 'text-ink-900' : 'text-ink-500'}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      <View className="rounded-2xl bg-ink-900 p-5 shadow-lifted">
        <View className="flex-row items-center gap-2 mb-3">
          <View className="h-2 w-2 rounded-full bg-green-400" />
          <Text className="text-[10px] font-semibold tracking-wide uppercase text-white">Canlı İstatistikler</Text>
          <Text className="text-[10px] text-ink-300 ml-auto">{new Date(data.live.timestamp).toLocaleTimeString('tr-TR')}</Text>
        </View>
        <View className="flex-row flex-wrap gap-3">
          <LiveStat label="Sipariş" value={data.live.todayOrders} icon={<Activity size={13} color="#fff" />} />
          <LiveStat label="Ciro" value={`₺${data.live.todayRevenue.toLocaleString('tr-TR')}`} icon={<TrendingUp size={13} color="#fff" />} />
          <LiveStat label="Ücretsiz Kahve" value={data.live.todayFreeCoffees} icon={<Coffee size={13} color="#fff" />} />
          <LiveStat label="Damga Kartı" value={data.live.todayStampCards} icon={<Gift size={13} color="#fff" />} />
          <LiveStat label="Aktif Kullanıcı" value={data.live.activeUsersToday} icon={<Users size={13} color="#fff" />} />
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1 p-1 bg-ink-100 rounded-2xl">
        {([
          { id: 'overview', label: 'Genel', icon: Activity },
          { id: 'freecoffee', label: 'Ücretsiz Kahve', icon: Coffee },
          { id: 'suspicious', label: 'Şüpheli', icon: AlertTriangle },
          { id: 'leaderboard', label: 'Liderlik', icon: Award },
        ] as const).map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            className={cn(
              'flex-row items-center gap-1 px-3 py-2 rounded-xl',
              tab === t.id ? 'bg-white shadow-card' : '',
            )}
          >
            <t.icon size={14} color={tab === t.id ? '#18181B' : '#9494A0'} />
            <Text className={cn('text-xs font-medium', tab === t.id ? 'text-ink-900' : 'text-ink-500')}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[160px]"><StatCard label="Tamamlanan Damga" value={String(s.totalStampCardsCompleted)} icon={<Gift size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Aktif Damga" value={String(s.activeStampCards)} icon={<Award size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Ücretsiz Kahve" value={String(s.totalFreeCoffees)} icon={<Coffee size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Toplam Sipariş" value={String(s.totalOrders)} icon={<TrendingUp size={18} color="#C8102E" />} /></View>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[160px]"><StatCard label="Ciro" value={`₺${s.totalRevenue.toLocaleString('tr-TR')}`} icon={<TrendingUp size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Puan Kazanç" value={s.pointsEarned.toLocaleString('tr-TR')} icon={<TrendingUp size={18} color="#16a34a" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Puan Kullanım" value={s.pointsRedeemed.toLocaleString('tr-TR')} icon={<TrendingDown size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Müşteri" value={s.totalCustomers.toLocaleString('tr-TR')} icon={<Users size={18} color="#C8102E" />} /></View>
          </View>

          {timeSeriesData.length > 1 && (
            <View className="gap-4">
              <Card className="p-4">
                <SectionHeader title="Ücretsiz Kahve Trendi" subtitle="Zaman içinde dağılım" />
                <LineChart data={timeSeriesData} height={200} color="#C8102E" />
              </Card>
              <Card className="p-4">
                <SectionHeader title="Damga Kartı Tamamlama" subtitle="Zaman içinde dağılım" />
                <LineChart data={stampSeriesData} height={200} color="#18181B" />
              </Card>
            </View>
          )}

          {storeChart.length > 0 && (
            <View className="gap-4">
              <Card className="p-4">
                <SectionHeader title="Şube — Ücretsiz Kahve" subtitle="Şube bazında" />
                <BarChart data={storeChart} height={200} color="#C8102E" />
              </Card>
              <Card className="p-4">
                <SectionHeader title="Şube — Ciro" subtitle="Şube bazında" />
                <BarChart data={revenueChart} height={200} color="#18181B" />
              </Card>
            </View>
          )}

          {productChartData.length > 0 && (
            <Card className="p-4">
              <SectionHeader title="Ücretsiz Verilen Ürünler" subtitle="Ürün bazında analiz" />
              <View className="gap-3">
                {data.freeCoffeeByProduct.map((p, i) => {
                  const max = data.freeCoffeeByProduct[0]?.count ?? 1;
                  return (
                    <View key={p.name}>
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs text-ink-600">{i + 1}. {p.name}</Text>
                        <Text className="text-xs font-semibold text-ink-900">{p.count} adet</Text>
                      </View>
                      <View className="h-2 rounded-full bg-ink-100 overflow-hidden">
                        <View className="h-full rounded-full bg-ex-red" style={{ width: `${(p.count / max) * 100}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}
        </View>
      )}

      {tab === 'freecoffee' && (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[160px]"><StatCard label="Ücretsiz Kahve" value={String(s.totalFreeCoffees)} icon={<Coffee size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Damga Kartı" value={String(s.totalStampCardsCompleted)} icon={<Gift size={18} color="#C8102E" />} /></View>
            <View className="flex-1 min-w-[160px]"><StatCard label="Aktif Damga" value={String(s.activeStampCards)} icon={<Award size={18} color="#C8102E" />} /></View>
          </View>

          {data.userStampRanking.length > 0 && (
            <Card className="p-4">
              <SectionHeader title="Müşteri Bazlı Damga" subtitle="En çok tamamlayanlar" />
              <View className="gap-2">
                {data.userStampRanking.map((u, i) => (
                  <View key={u.userId} className="flex-row items-center gap-3 py-2 border-b border-ink-50">
                    <View className={cn(
                      'h-8 w-8 rounded-xl items-center justify-center',
                      i === 0 ? 'bg-gold-100' : i === 1 ? 'bg-ink-100' : i === 2 ? 'bg-amber-50' : 'bg-ink-50',
                    )}>
                      <Text className={cn(
                        'text-xs font-bold',
                        i === 0 ? 'text-gold-700' : i === 1 ? 'text-ink-700' : i === 2 ? 'text-amber-700' : 'text-ink-400',
                      )}>{i + 1}</Text>
                    </View>
                    <Text className="text-sm font-medium text-ink-900 flex-1" numberOfLines={1}>{u.fullName}</Text>
                    <Text className="text-sm font-semibold text-ex-red">{u.cardsCompleted} kart</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Card className="p-4">
            <SectionHeader title="Ücretsiz Kahve Kayıtları" subtitle="Tarih, kullanıcı, ürün ve şube bazında" />
            {data.freeCoffeeLog.length === 0 ? (
              <EmptyState title="Kayıt yok" subtitle="Bu dönemde ücretsiz kahve verilmemiş" icon={Coffee} />
            ) : (
              <View className="gap-0">
                {data.freeCoffeeLog.slice(0, 50).map((r, i) => (
                  <View key={r.id + i} className="py-2.5 border-b border-ink-50">
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{r.fullName}</Text>
                      <Text className="text-xs text-ink-400">{new Date(r.redeemedAt).toLocaleDateString('tr-TR')}</Text>
                    </View>
                    <View className="flex-row justify-between mt-0.5">
                      <Text className="text-xs text-ink-600" numberOfLines={1}>{r.productName}</Text>
                      {scope === 'hq' && <Text className="text-xs text-ink-400">{r.storeName}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {tab === 'suspicious' && (
        <Card className="p-4">
          <SectionHeader title="Şüpheli Kullanım" subtitle="Otomatik tespit edilen anormallikler" />
          {data.suspiciousActivity.length === 0 ? (
            <EmptyState title="Şüpheli kullanım yok" subtitle="Anormallik tespit edilmedi" icon={AlertTriangle} />
          ) : (
            <View className="gap-3">
              {data.suspiciousActivity.map((a) => (
                <View key={a.id} className={cn(
                  'p-4 rounded-xl border',
                  a.severity === 'high' ? 'border-red-200 bg-red-50' : a.severity === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-ink-200 bg-ink-50',
                )}>
                  <View className="flex-row items-start gap-3">
                    <View className={cn(
                      'h-9 w-9 rounded-xl items-center justify-center',
                      a.severity === 'high' ? 'bg-red-100' : a.severity === 'medium' ? 'bg-amber-100' : 'bg-ink-100',
                    )}>
                      <AlertTriangle size={16} color={a.severity === 'high' ? '#C8102E' : a.severity === 'medium' ? '#d97706' : '#6E6E78'} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-sm font-semibold text-ink-900">{suspiciousLabel(a.type)}</Text>
                        <Text className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          a.severity === 'high' ? 'bg-red-200 text-ex-red' : a.severity === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-ink-200 text-ink-600',
                        )}>{severityLabel(a.severity)}</Text>
                        {a.resolved && <Text className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Çözüldü</Text>}
                      </View>
                      <Text className="text-xs text-ink-500 mt-1">{a.description}</Text>
                      <View className="flex-row items-center gap-1 mt-1.5">
                        <Clock size={10} color="#9494A0" />
                        <Text className="text-[10px] text-ink-400">{new Date(a.detectedAt).toLocaleString('tr-TR')}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      {tab === 'leaderboard' && (
        <View className="gap-4">
          <Card className="p-4">
            <SectionHeader title="Liderlik Tablosu" subtitle="En çok ücretsiz kahve veren şubeler" />
            {data.leaderboard.length === 0 ? (
              <EmptyState title="Veri yok" subtitle="Şube karşılaştırma verisi bulunmuyor" icon={Award} />
            ) : (
              <View className="gap-2.5">
                {data.leaderboard.map((l, i) => (
                  <View key={l.storeId} className="flex-row items-center gap-3 p-3 rounded-xl bg-ink-50">
                    <View className={cn(
                      'h-10 w-10 rounded-xl items-center justify-center',
                      i === 0 ? 'bg-gold-100' : i === 1 ? 'bg-ink-200' : i === 2 ? 'bg-amber-100' : 'bg-ink-100',
                    )}>
                      {i === 0 ? <Crown size={18} color="#A00D24" /> : <Text className={cn('text-sm font-bold', i === 1 ? 'text-ink-700' : i === 2 ? 'text-amber-700' : 'text-ink-400')}>{i + 1}</Text>}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <StoreIcon size={13} color="#9494A0" />
                        <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{l.storeName}</Text>
                      </View>
                      <Text className="text-[11px] text-ink-400">{l.freeCoffees} ücretsiz kahve</Text>
                    </View>
                    <Text className="text-lg font-bold text-ex-red">{l.freeCoffees}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {data.storeComparison.length > 0 && (
            <Card className="p-4">
              <SectionHeader title="Tüm Şubeler — Performans" subtitle="Karşılaştırmalı tablo" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View className="flex-row border-b border-ink-100 pb-2 px-1">
                    <Text className="text-[10px] text-ink-400 uppercase font-semibold w-24">Şube</Text>
                    <Text className="text-[10px] text-ink-400 uppercase font-semibold w-14 text-right">Damga</Text>
                    <Text className="text-[10px] text-ink-400 uppercase font-semibold w-14 text-right">Kahve</Text>
                    <Text className="text-[10px] text-ink-400 uppercase font-semibold w-16 text-right">Ciro</Text>
                  </View>
                  {data.storeComparison.map(r => (
                    <View key={r.storeId} className="flex-row py-2.5 border-b border-ink-50 px-1">
                      <Text className="text-sm font-medium text-ink-900 w-24" numberOfLines={1}>{r.storeName}</Text>
                      <Text className="text-sm font-semibold text-ink-900 w-14 text-right">{r.stampCards}</Text>
                      <Text className="text-sm font-semibold text-ex-red w-14 text-right">{r.freeCoffees}</Text>
                      <Text className="text-sm font-semibold text-ink-900 w-16 text-right">₺{r.revenue.toLocaleString('tr-TR')}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function LiveStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <View className="flex-1 min-w-[100px]">
      <View className="flex-row items-center gap-1.5 mb-1">
        {icon}
        <Text className="text-[9px] uppercase tracking-wide font-semibold text-ink-300">{label}</Text>
      </View>
      <Text className="text-xl font-bold text-white">{value}</Text>
    </View>
  );
}

function suspiciousLabel(type: string): string {
  const map: Record<string, string> = {
    rapid_repeat_scan: 'Hızlı Tekrarlı Tarama',
    self_stamp: 'Kendi QR\'ını Okutma',
    self_points: 'Kendi Hesabına Puan Yükleme',
    unusual_redemption: 'Anormal Ödül Kullanımı',
    duplicate_qr: 'Çift QR Kullanımı',
  };
  return map[type] ?? type;
}

function severityLabel(s: string): string {
  return s === 'high' ? 'Yüksek' : s === 'medium' ? 'Orta' : 'Düşük';
}
