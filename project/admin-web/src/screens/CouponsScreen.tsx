import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Ticket, Copy } from 'lucide-react';
import { fetchCoupons, createCoupon, updateCoupon, deleteCoupon } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import type { Coupon } from '../lib/supabase';

export function CouponsScreen() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<Coupon | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchCoupons()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kuponlar yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (c: Coupon) => {
    try { await deleteCoupon(c.id); setItems(prev => prev?.filter(x => x.id !== c.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); success('Kupon kodu kopyalandı'); };

  return (
    <div>
      <PageHeader title="Kupon Yönetimi" subtitle="İndirim kuponları oluşturun ve yönetin"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Kupon</Button>} />

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !items || items.length === 0 ? <EmptyState title="Kupon yok" subtitle="İlk kuponu ekleyin" /> :
       <>
       <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Kupon ara…" /></div>
       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
         {items.map(c => (
           <Card key={c.id} className="p-5">
             <div className="flex items-start justify-between">
               <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center"><Ticket size={18} className="text-gold-600" /></div>
               <Badge tone={c.is_active ? 'green' : 'neutral'}>{c.is_active ? 'Aktif' : 'Pasif'}</Badge>
             </div>
             <div className="mt-3 flex items-center gap-2">
               <code className="text-lg font-bold text-ink-900 font-mono">{c.code}</code>
               <button onClick={() => copyCode(c.code)} className="text-ink-400 hover:text-ex-red"><Copy size={14} /></button>
             </div>
             <p className="text-sm font-medium text-ink-700 mt-1">{c.title}</p>
             <p className="text-xs text-ink-400 mt-0.5">{c.description}</p>
             <div className="flex items-center gap-2 mt-3">
               <Badge tone="dark">{c.type === 'percent' ? `%${c.value}` : c.type === 'fixed' ? `₺${c.value}` : c.type}</Badge>
               <Badge tone="neutral">{c.redemptions_count} kullanım</Badge>
             </div>
             <div className="text-xs text-ink-400 mt-3 pt-3 border-t border-ink-100">
               {c.starts_at ? formatDate(c.starts_at) : '—'} → {c.ends_at ? formatDate(c.ends_at) : '—'}
             </div>
             <div className="flex gap-1.5 mt-3">
               <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(c)}><Edit2 size={13} /> Düzenle</Button>
               <Button variant="danger" size="sm" onClick={() => setConfirmDel(c)}><Trash2 size={13} /></Button>
             </div>
           </Card>
         ))}
       </div>
       </>
      }

      <CouponModal open={editing !== null || creating} coupon={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Kuponu Sil" message={`"${confirmDel?.code ?? ''}" kuponu silinsin mi?`} />
    </div>
  );
}

function CouponModal({ open, coupon, onClose, onSaved }: { open: boolean; coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Coupon>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(coupon ? { ...coupon } : { code: '', title: '', description: '', type: 'percent', value: 10, min_order: 0, target_segment: 'all', is_active: true, redemptions_count: 0 });
  }, [open, coupon]);

  const save = async () => {
    setSaving(true);
    try {
      if (coupon) await updateCoupon(coupon.id, form);
      else await createCoupon({ ...form, code: (form.code ?? '').toUpperCase() });
      onSaved(); toastSuccess('Kaydedildi');
    } catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={coupon ? 'Kupon Düzenle' : 'Yeni Kupon'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="admin-label">Kupon Kodu</label><input className="admin-input font-mono uppercase" value={form.code ?? ''} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
        <div><label className="admin-label">Başlık</label><input className="admin-input" value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="col-span-2"><label className="admin-label">Açıklama</label><input className="admin-input" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div><label className="admin-label">Tip</label>
          <select className="admin-input" value={form.type ?? 'percent'} onChange={e => setForm(f => ({ ...f, type: e.target.value as Coupon['type'] }))}>
            <option value="percent">Yüzde İndirim</option><option value="fixed">Sabit Tutar</option><option value="free_item">Ücretsiz Ürün</option><option value="bxgy">Alana Bir Hediye</option>
          </select>
        </div>
        <div><label className="admin-label">Değer</label><input type="number" className="admin-input" value={form.value ?? 0} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">Min. Sepet</label><input type="number" className="admin-input" value={form.min_order ?? 0} onChange={e => setForm(f => ({ ...f, min_order: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">Hedef</label>
          <select className="admin-input" value={form.target_segment ?? 'all'} onChange={e => setForm(f => ({ ...f, target_segment: e.target.value }))}>
            <option value="all">Tüm Müşteriler</option><option value="vip">VIP</option><option value="new">Yeni</option>
          </select>
        </div>
        <div><label className="admin-label">Başlangıç</label><input type="date" className="admin-input" value={form.starts_at?.slice(0,10) ?? ''} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
        <div><label className="admin-label">Bitiş</label><input type="date" className="admin-input" value={form.ends_at?.slice(0,10) ?? ''} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif</label>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
