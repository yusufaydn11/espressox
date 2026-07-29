import { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  accountService, ledgerService, invoiceService,
  b2bFormatTRY, b2bFormatDateTime,
  B2B_INVOICE_STATUS_LABELS, B2B_INVOICE_STATUS_TONES, B2B_RISK_LABELS, B2B_RISK_TONES,
  type B2BAccountSummary, type B2BLedgerEntry, type B2BInvoice,
} from '@/services/b2b';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BStatTile, B2BStatusBadge,
  B2BLoadingSpinner, B2BErrorState, B2BEmptyState,
} from '@/components/b2b';

const invStatusTone = (s: string) => B2B_INVOICE_STATUS_TONES[s] ?? 'neutral';

export function B2BAccount({ franchiseId }: { franchiseId: string }) {
  const [summary, setSummary] = useState<B2BAccountSummary | null>(null);
  const [ledger, setLedger] = useState<B2BLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!franchiseId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [s, l] = await Promise.all([accountService.getSummary(franchiseId), ledgerService.getRecent()]);
      setSummary(s); setLedger(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cari hesap yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Cari hesap yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;
  if (!summary) return <B2BScreenWrapper><B2BErrorState message="Cari hesap bulunamadı" /></B2BScreenWrapper>;

  const balanceTone = summary.balance > 0 ? 'text-ex-red' : summary.balance < 0 ? 'text-blue-600' : 'text-green-600';

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Cari Hesap" subtitle="Bakiye, hareketler ve ekstre" />

      <View className="flex-row flex-wrap gap-3 mb-5">
        <B2BStatTile label="Toplam Borç" value={b2bFormatTRY(summary.total_debit)} icon={<TrendingUp size={16} color="#C8102E" />} accent="bg-ex-red/10" />
        <B2BStatTile label="Toplam Alacak" value={b2bFormatTRY(summary.total_credit)} icon={<TrendingDown size={16} color="#16a34a" />} accent="bg-green-50" />
        <View className={cn('rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-1 min-w-[140px]', summary.balance > 0 && 'border-ex-red/20')}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Bakiye</Text>
            <View className="h-8 w-8 rounded-lg bg-ink-50 items-center justify-center"><Wallet size={16} color="#3D3D42" /></View>
          </View>
          <Text className={cn('text-xl font-bold mt-2', balanceTone)}>{b2bFormatTRY(Math.abs(summary.balance))}</Text>
          <Text className={cn('text-[11px] mt-0.5', balanceTone)}>{summary.balance > 0 ? 'Borçlu' : summary.balance < 0 ? 'Alacaklı' : 'Kapalı'}</Text>
        </View>
      </View>

      {summary.credit && (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
          <Text className="text-sm font-bold text-ink-900 mb-4">Kredi & Risk Durumu</Text>
          <View className="flex-row flex-wrap gap-4">
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-ink-400">Limit</Text><Text className="text-sm font-bold text-ink-900 mt-1">{b2bFormatTRY(summary.credit.credit_limit)}</Text></View>
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-ink-400">Borç</Text><Text className="text-sm font-bold text-ink-900 mt-1">{b2bFormatTRY(summary.credit.current_balance)}</Text></View>
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-ink-400">Vade</Text><Text className="text-sm font-bold text-ink-900 mt-1">{summary.credit.payment_terms_days} gün</Text></View>
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-ink-400">Risk</Text><View className="mt-1"><B2BStatusBadge label={B2B_RISK_LABELS[summary.credit.risk_status]} tone={B2B_RISK_TONES[summary.credit.risk_status]} /></View></View>
          </View>
        </View>
      )}

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
        <Text className="text-sm font-bold text-ink-900 mb-4">Açık Faturalar</Text>
        {summary.open_invoices.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center py-6">Açık fatura yok</Text>
        ) : (
          <View>
            {summary.open_invoices.map((inv, i) => (
              <View key={inv.id} className={cn('flex-row items-center justify-between py-2.5', i > 0 && 'border-t border-ink-50')}>
                <View><Text className="text-sm font-medium text-ink-900">{inv.invoice_number}</Text><Text className="text-[11px] text-ink-400">{b2bFormatDateTime(inv.created_at)}</Text></View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-ink-900">{b2bFormatTRY(inv.total)}</Text>
                  <B2BStatusBadge label={B2B_INVOICE_STATUS_LABELS[inv.status] ?? inv.status} tone={invStatusTone(inv.status)} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">Son Hareketler</Text>
        {ledger.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center py-6">Hareket yok</Text>
        ) : (
          <View>
            {ledger.slice(0, 10).map((entry, i) => (
              <View key={entry.id} className={cn('flex-row items-center justify-between py-2.5', i > 0 && 'border-t border-ink-50')}>
                <View className="flex-row items-center gap-3 flex-1 min-w-0">
                  <View className={cn('h-8 w-8 rounded-lg items-center justify-center shrink-0', entry.type === 'debit' ? 'bg-red-50' : 'bg-green-50')}>
                    {entry.type === 'debit' ? <TrendingUp size={16} color="#C8102E" /> : <TrendingDown size={16} color="#16a34a" />}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{entry.description}</Text>
                    <Text className="text-[11px] text-ink-400">{b2bFormatDateTime(entry.created_at)}</Text>
                  </View>
                </View>
                <Text className={cn('text-sm font-bold shrink-0', entry.type === 'debit' ? 'text-ex-red' : 'text-green-600')}>
                  {entry.type === 'debit' ? '+' : '-'}{b2bFormatTRY(entry.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </B2BScreenWrapper>
  );
}

export function B2BInvoices({ franchiseId }: { franchiseId: string }) {
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await invoiceService.getRecent();
      setInvoices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Faturalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Faturalar yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Faturalar" subtitle="Tüm faturalarınız" />
      {invoices.length === 0 ? (
        <B2BEmptyState title="Fatura bulunamadı" />
      ) : (
        <View className="gap-3">
          {invoices.map(inv => (
            <View key={inv.id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-row items-center gap-3">
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-ink-900">{inv.invoice_number}</Text>
                <Text className="text-[11px] text-ink-400">{b2bFormatDateTime(inv.created_at)}</Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-sm font-bold text-ink-900">{b2bFormatTRY(inv.total)}</Text>
                <B2BStatusBadge label={B2B_INVOICE_STATUS_LABELS[inv.status] ?? inv.status} tone={invStatusTone(inv.status)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </B2BScreenWrapper>
  );
}
