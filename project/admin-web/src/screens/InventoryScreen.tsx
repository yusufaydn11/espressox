import { useEffect, useState, useCallback } from 'react';
import { Plus, Boxes, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchInventoryItems, fetchStoreStock, createInventoryItem, addInventoryMovement } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, Pagination } from '../lib/ui';
import { useToast } from '../lib/toast';
import type { InventoryItem, StoreStock } from '../lib/supabase';

export function InventoryScreen() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [stock, setStock] = useState<StoreStock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const [i, s] = await Promise.all([fetchInventoryItems(), fetchStoreStock()]); setItems(i); setStock(s); }
    catch (e) { setError(e instanceof Error ? e.message : 'Stok yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stockFor = (itemId: string) => stock?.filter(s => s.item_id === itemId) ?? [];

  const filteredItems = (items ?? []).filter(it => it.name.toLowerCase().includes(search.toLowerCase()) || (it.sku ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Stok Yönetimi" subtitle="Ürün stokları ve şube bazlı durum"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Stok Kalemi</Button>} />

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !items || items.length === 0 ? <EmptyState title="Stok kalemi yok" subtitle="İlk stok kalemini ekleyin" /> :
       <div className="space-y-4">
         {/* Critical stock alerts */}
         {stock && stock.some(s => s.current_stock <= s.min_stock) && (
           <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center"><AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" /></div>
               <div><p className="text-sm font-bold text-amber-800 dark:text-amber-400">Kritik Stok Uyarısı</p><p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">{stock.filter(s => s.current_stock <= s.min_stock).length} kalem minimum stok seviyesinin altında</p></div>
             </div>
           </Card>
         )}
         <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Stok kalemi ara…" /></div>
         <Card className="overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-800">
                 <tr className="text-left text-xs text-ink-400 dark:text-ink-400 uppercase tracking-wide">
                   <th className="px-4 py-3 font-semibold">Kalem</th>
                   <th className="px-4 py-3 font-semibold">SKU</th>
                   <th className="px-4 py-3 font-semibold">Min. Stok</th>
                   <th className="px-4 py-3 font-semibold">Mevcut</th>
                   <th className="px-4 py-3 font-semibold">Durum</th>
                   <th className="px-4 py-3"></th>
                 </tr>
               </thead>
               <tbody>
                 {pagedItems.map(it => {
                   const rows = stockFor(it.id);
                   const total = rows.reduce((s, r) => s + r.current_stock, 0);
                   const critical = rows.some(r => r.current_stock <= r.min_stock);
                   return (
                     <tr key={it.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                       <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-cream-100 dark:bg-ink-800 flex items-center justify-center"><Boxes size={15} className="text-ink-600 dark:text-ink-300" /></div><div><p className="font-semibold text-ink-900 dark:text-ink-100">{it.name}</p><p className="text-xs text-ink-400 dark:text-ink-400">{it.unit}</p></div></div></td>
                       <td className="px-4 py-3.5 font-mono text-xs text-ink-400 dark:text-ink-400">{it.sku}</td>
                       <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">{it.min_stock}</td>
                       <td className="px-4 py-3.5 font-bold text-ink-900 dark:text-ink-100">{total}</td>
                       <td className="px-4 py-3.5"><Badge tone={critical ? 'red' : 'green'}>{critical ? 'Kritik' : 'Yeterli'}</Badge></td>
                       <td className="px-4 py-3.5"><Button variant="outline" size="sm" onClick={() => setAdjusting(it)}>Stok Güncelle</Button></td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
           {totalPages > 1 && <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />}
         </Card>
       </div>
      }

      <ItemModal open={creating} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />
      <AdjustModal item={adjusting} stock={stock} userId={user?.id ?? null} onClose={() => setAdjusting(null)} onSaved={async () => { setAdjusting(null); await load(); }} />
    </div>
  );
}

function ItemModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<InventoryItem>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ sku: '', name: '', unit: 'adet', min_stock: 0, cost_per_unit: 0 }); }, [open]);
  const save = async () => {
    setSaving(true);
    try { await createInventoryItem(form); onSaved(); success('Kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Yeni Stok Kalemi">
      <div className="space-y-4">
        <div><label className="admin-label">Ad</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="admin-label">SKU</label><input className="admin-input" value={form.sku ?? ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
          <div><label className="admin-label">Birim</label><input className="admin-input" value={form.unit ?? ''} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></div>
          <div><label className="admin-label">Min. Stok</label><input type="number" className="admin-input" value={form.min_stock ?? 0} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} /></div>
          <div><label className="admin-label">Birim Maliyet</label><input type="number" step="0.01" className="admin-input" value={form.cost_per_unit ?? 0} onChange={e => setForm(f => ({ ...f, cost_per_unit: Number(e.target.value) }))} /></div>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}

function AdjustModal({ item, stock, userId, onClose, onSaved }: { item: InventoryItem | null; stock: StoreStock[] | null; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const [delta, setDelta] = useState(0);
  const [storeId, setStoreId] = useState('');
  const [reason, setReason] = useState('adjustment');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (item) { setDelta(0); setStoreId(''); setReason('adjustment'); } }, [item]);
  if (!item) return null;
  const rows = stock?.filter(s => s.item_id === item.id) ?? [];

  const save = async () => {
    if (!storeId || delta === 0) { toastError('Şube ve miktar zorunlu'); return; }
    setSaving(true);
    try { await addInventoryMovement({ item_id: item.id, store_id: storeId, delta, reason, actor_id: userId }); onSaved(); success('Güncellendi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!item} onClose={onClose} title={`Stok Güncelle — ${item.name}`}>
      <div className="space-y-4">
        <div><label className="admin-label">Şube</label>
          <select className="admin-input" value={storeId ?? ''} onChange={e => setStoreId(e.target.value)}>
            <option value="">Seçiniz</option>
            {Array.from(new Set(rows.map(r => r.store_id).filter((v): v is string => Boolean(v)))).map(sid => <option key={sid} value={sid}>{sid}</option>)}
          </select>
        </div>
        <div><label className="admin-label">Miktar (+ giriş / − çıkış)</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDelta(d => d - 1)}><TrendingDown size={14} /></Button>
            <input type="number" className="admin-input text-center" value={delta} onChange={e => setDelta(Number(e.target.value))} />
            <Button variant="outline" size="sm" onClick={() => setDelta(d => d + 1)}><TrendingUp size={14} /></Button>
          </div>
        </div>
        <div><label className="admin-label">Sebep</label>
          <select className="admin-input" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="adjustment">Düzeltme</option><option value="purchase">Alım</option><option value="waste">Fire</option><option value="sale">Satış</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
