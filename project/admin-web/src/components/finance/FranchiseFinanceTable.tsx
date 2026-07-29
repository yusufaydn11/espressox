import { memo } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../lib/ui';
import { formatTRY, formatNum } from '../../lib/utils';
import type { FranchiseFinanceRow } from '../../hooks/useHqFinance';

export const FranchiseFinanceTable = memo(function FranchiseFinanceTable({
  rows,
  onSelect,
}: {
  rows: FranchiseFinanceRow[];
  onSelect: (franchiseId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="Franchise verisi yok" subtitle="Henüz franchise kaydı bulunmuyor" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden min-w-0">
      <div className="p-5 border-b border-ink-100 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-ex-red" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Franchise Bazlı Finans</h3>
        </div>
        <p className="text-xs text-ink-400 mt-1">B2B hacim, açık sipariş ve ödeme durumu</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
            <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Franchise</th>
              <th className="px-4 py-3 font-semibold">Sipariş</th>
              <th className="px-4 py-3 font-semibold">Toplam Hacim</th>
              <th className="px-4 py-3 font-semibold">Açık Tutar</th>
              <th className="px-4 py-3 font-semibold">Teslim Edilen</th>
              <th className="px-4 py-3 font-semibold">Bekleyen Ödeme</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.franchise.id}
                className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover cursor-pointer"
                onClick={() => onSelect(row.franchise.id)}
              >
                <td className="px-4 py-3 font-semibold text-ink-900 dark:text-ink-100">{row.franchise.company_name}</td>
                <td className="px-4 py-3 text-ink-600">{formatNum(row.orderCount)}</td>
                <td className="px-4 py-3 font-bold text-ex-red">{formatTRY(row.totalVolume)}</td>
                <td className="px-4 py-3">
                  {row.openAmount > 0 ? (
                    <Badge tone="amber">{formatTRY(row.openAmount)}</Badge>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-600">{formatTRY(row.deliveredVolume)}</td>
                <td className="px-4 py-3">
                  {row.pendingPayments > 0 ? (
                    <Badge tone="amber">{row.pendingPayments}</Badge>
                  ) : (
                    <Badge tone="green">0</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ChevronRight size={16} className="text-ink-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});
