import { ReportDashboard } from '@/components/ReportDashboard';

interface FranchiseReportsProps {
  storeId: string | null;
  storeName: string;
}

export function FranchiseReports({ storeId, storeName }: FranchiseReportsProps) {
  return (
    <ReportDashboard
      scope="store"
      storeId={storeId}
      title={`${storeName || 'Şube'} — Raporlar`}
      subtitle="Yalnızca bu şubeye ait veriler. Tüm şubeler arası karşılaştırma merkez panelindedir."
    />
  );
}
