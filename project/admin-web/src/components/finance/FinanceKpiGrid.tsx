import { DollarSign, FileText, Clock, Building2, TrendingUp, Wallet } from 'lucide-react';
import { EnterpriseKpiCard } from '../dashboard/EnterpriseKpiCard';
import { formatTRY, formatNum } from '../../lib/utils';
import type { HqFinanceSummary } from '../../hooks/useHqFinance';

export function FinanceKpiGrid({ summary }: { summary: HqFinanceSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <EnterpriseKpiCard
        variant="primary"
        label="B2B Toplam Hacim"
        value={formatTRY(summary.totalB2BVolume)}
        sub={`${formatNum(summary.franchiseCount)} franchise`}
        icon={<DollarSign size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        variant="gold"
        label="Açık Faturalar"
        value={formatTRY(summary.openInvoiceAmount)}
        sub={`${summary.openInvoiceCount} fatura`}
        icon={<FileText size={18} className="text-gold-700" />}
      />
      <EnterpriseKpiCard
        label="Bekleyen Ödemeler"
        value={formatTRY(summary.pendingPaymentAmount)}
        sub={`${summary.pendingPaymentCount} işlem`}
        icon={<Clock size={18} className="text-amber-600" />}
      />
      <EnterpriseKpiCard
        label="Perakende Aylık Ciro"
        value={formatTRY(summary.retailMonthRevenue)}
        sub="HQ perakende"
        icon={<TrendingUp size={18} className="text-ex-red" />}
      />
      <EnterpriseKpiCard
        variant="dark"
        label="Bugünkü Satış"
        value={formatTRY(summary.todaySales)}
        sub="Tüm kanallar"
        icon={<Wallet size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        label="Franchise Sayısı"
        value={formatNum(summary.franchiseCount)}
        sub="Aktif cari hesap"
        icon={<Building2 size={18} className="text-ink-600" />}
      />
    </div>
  );
}
