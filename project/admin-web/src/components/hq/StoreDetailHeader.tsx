import { MapPin, Phone, Store, Building2, Wifi, Car, AlertTriangle } from 'lucide-react';
import { Badge, Card } from '../../lib/ui';
import type { Store as StoreType, Franchise } from '../../lib/supabase';

export function StoreDetailHeader({
  store,
  franchise,
  rank,
}: {
  store: StoreType;
  franchise: Franchise | null;
  rank?: number | null;
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="h-16 w-16 rounded-2xl bg-ink-900 flex items-center justify-center shrink-0">
          <Store size={24} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 font-display">{store.name}</h2>
            <Badge tone={store.open ? 'green' : 'red'}>{store.open ? 'Açık' : 'Kapalı'}</Badge>
            {rank && <Badge tone="gold">#{rank} Sıra</Badge>}
            {!store.franchise_id && (
              <Badge tone="amber"><AlertTriangle size={10} /> Franchise yok</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
            <span className="flex items-center gap-1"><MapPin size={12} /> {store.address}</span>
            {store.phone && <span className="flex items-center gap-1"><Phone size={12} /> {store.phone}</span>}
            {franchise && (
              <span className="flex items-center gap-1"><Building2 size={12} /> {franchise.company_name}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {store.wifi && <Badge tone="neutral"><Wifi size={10} /> WiFi</Badge>}
            {store.parking && <Badge tone="neutral"><Car size={10} /> Otopark</Badge>}
            {store.drive_thru && <Badge tone="neutral">Drive-thru</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
}
