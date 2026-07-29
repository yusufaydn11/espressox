import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Building2, Phone, Mail } from 'lucide-react';
import { fetchFranchises, createFranchise, updateFranchise, deleteFranchise } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, Pagination, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import type { Franchise } from '../lib/supabase';

export function FranchisesScreen() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Franchise[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Franchise | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDel, setConfirmDel] = useState<Franchise | null>(null);
  const PAGE_SIZE = 10;

  const filtered = (items ?? []).filter(f => f.company_name.toLowerCase().includes(search.toLowerCase()) || (f.authorized_person ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchFranchises()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Franchise yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (f: Franchise) => {
    try { await deleteFranchise(f.id); setItems(prev => prev?.filter(x => x.id !== f.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  return (
    <div>
      <PageHeader title="Franchise Yönetimi" subtitle="Franchise şirket hesapları"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Franchise</Button>} />

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !items || items.length === 0 ? <EmptyState title="Franchise yok" subtitle="İlk franchise kaydını ekleyin" /> :
       <Card className="overflow-hidden">
         <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Franchise ara…" /></div>
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-800">
               <tr className="text-left text-xs text-ink-400 dark:text-ink-400 uppercase tracking-wide">
                 <th className="px-4 py-3 font-semibold">Firma</th>
                 <th className="px-4 py-3 font-semibold">Yetkili</th>
                 <th className="px-4 py-3 font-semibold">İletişim</th>
                 <th className="px-4 py-3 font-semibold">Royalty</th>
                 <th className="px-4 py-3 font-semibold">Durum</th>
                 <th className="px-4 py-3 font-semibold">Sözleşme</th>
                 <th className="px-4 py-3"></th>
               </tr>
             </thead>
             <tbody>
               {paged.map(f => (
                 <tr key={f.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                   <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-cream-200 dark:bg-ink-700 flex items-center justify-center"><Building2 size={15} className="text-ink-600 dark:text-ink-300" /></div><span className="font-semibold text-ink-900 dark:text-ink-100">{f.company_name}</span></div></td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">{f.authorized_person}</td>
                   <td className="px-4 py-3.5 text-ink-400 dark:text-ink-400 text-xs">{f.authorized_phone || f.authorized_email || '—'}</td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">%{f.royalty_percent}</td>
                   <td className="px-4 py-3.5"><Badge tone={f.status === 'active' ? 'green' : f.status === 'suspended' ? 'amber' : 'red'}>{f.status === 'active' ? 'Aktif' : f.status === 'suspended' ? 'Askıda' : 'Feshedildi'}</Badge></td>
                   <td className="px-4 py-3.5 text-ink-400 dark:text-ink-400 text-xs">{f.contract_start ? formatDate(f.contract_start) : '—'} → {f.contract_end ? formatDate(f.contract_end) : '—'}</td>
                   <td className="px-4 py-3.5"><div className="flex gap-1"><button onClick={() => setEditing(f)} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 flex items-center justify-center"><Edit2 size={14} className="text-ink-600 dark:text-ink-300" /></button><button onClick={() => setConfirmDel(f)} className="h-8 w-8 rounded-lg hover:bg-ex-100 flex items-center justify-center"><Trash2 size={14} className="text-ex-red" /></button></div></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
         {totalPages > 1 && <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />}
       </Card>
      }

      <FranchiseModal open={editing !== null || creating} franchise={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Franchise Sil" message={`"${confirmDel?.company_name ?? ''}" silinsin mi?`} />
    </div>
  );
}

function FranchiseModal({ open, franchise, onClose, onSaved }: { open: boolean; franchise: Franchise | null; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Franchise>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(franchise ? { ...franchise } : { company_name: '', authorized_person: '', tax_id: '', royalty_percent: 0, status: 'active' });
  }, [open, franchise]);
  const save = async () => {
    setSaving(true);
    try { if (franchise) await updateFranchise(franchise.id, form); else await createFranchise(form); onSaved(); toastSuccess('Kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={franchise ? 'Franchise Düzenle' : 'Yeni Franchise'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="admin-label">Firma Adı</label><input className="admin-input" value={form.company_name ?? ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
        <div><label className="admin-label">Vergi No</label><input className="admin-input" value={form.tax_id ?? ''} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></div>
        <div><label className="admin-label">Yetkili Kişi</label><input className="admin-input" value={form.authorized_person ?? ''} onChange={e => setForm(f => ({ ...f, authorized_person: e.target.value }))} /></div>
        <div><label className="admin-label">E-posta</label><input className="admin-input" value={form.authorized_email ?? ''} onChange={e => setForm(f => ({ ...f, authorized_email: e.target.value }))} /></div>
        <div><label className="admin-label">Telefon</label><input className="admin-input" value={form.authorized_phone ?? ''} onChange={e => setForm(f => ({ ...f, authorized_phone: e.target.value }))} /></div>
        <div><label className="admin-label">Royalty %</label><input type="number" step="0.1" className="admin-input" value={form.royalty_percent ?? 0} onChange={e => setForm(f => ({ ...f, royalty_percent: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">Durum</label><select className="admin-input" value={form.status ?? 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as Franchise['status'] }))}><option value="active">Aktif</option><option value="suspended">Askıda</option><option value="terminated">Feshedildi</option></select></div>
        <div><label className="admin-label">Sözleşme Başlangıç</label><input type="date" className="admin-input" value={form.contract_start ?? ''} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} /></div>
        <div><label className="admin-label">Sözleşme Bitiş</label><input type="date" className="admin-input" value={form.contract_end ?? ''} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} /></div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
