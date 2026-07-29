import { Link } from 'react-router-dom';
import { Coffee, Wrench } from 'lucide-react';
import { Button } from '../lib/ui';

export function NotFoundScreen() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="h-16 w-16 rounded-2xl bg-ex-red/10 flex items-center justify-center mb-4">
        <Coffee size={28} className="text-ex-red" />
      </div>
      <h1 className="text-xl font-bold text-ink-900">Sayfa Bulunamadı</h1>
      <p className="text-sm text-ink-500 mt-2 max-w-sm">Aradığınız sayfa mevcut değil veya erişim yetkiniz yok.</p>
      <Link to="/orders" className="mt-6">
        <Button>Siparişlere Dön</Button>
      </Link>
    </div>
  );
}

export function MaintenanceScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-8 text-center">
      <div className="h-16 w-16 rounded-2xl bg-ink-100 flex items-center justify-center mb-4">
        <Wrench size={28} className="text-ink-500" />
      </div>
      <h1 className="text-xl font-bold text-ink-900">Bakım Modu</h1>
      <p className="text-sm text-ink-500 mt-2 max-w-sm">Merkez yönetim paneli kısa süreliğine bakımda.</p>
    </div>
  );
}
