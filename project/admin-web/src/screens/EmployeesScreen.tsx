import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, UserCog, Phone, Mail } from 'lucide-react';
import { fetchEmployees, createEmployee, updateEmployee, deleteEmployee, fetchStores } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, Pagination, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import type { Employee, Store } from '../lib/supabase';

const roleLabels: Record<string, string> = { manager: 'Müdür', shift_lead: 'Vardiya Lideri', barista: 'Barista', cashier: 'Kasiyer', kitchen: 'Mutfak' };

export function EmployeesScreen() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Employee[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDel, setConfirmDel] = useState<Employee | null>(null);
  const PAGE_SIZE = 10;

  const filtered = (items ?? []).filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || (e.role ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const [e, s] = await Promise.all([fetchEmployees(), fetchStores()]); setItems(e); setStores(s); }
    catch (err) { setError(err instanceof Error ? err.message : 'Personel yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (e: Employee) => {
    try { await deleteEmployee(e.id); setItems(prev => prev?.filter(x => x.id !== e.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (err) { toastError(err instanceof Error ? err.message : 'Silinemedi'); }
  };

  return (
    <div>
      <PageHeader title="Personel Yönetimi" subtitle="Şube personeli kayıtları"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Personel</Button>} />

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !items || items.length === 0 ? <EmptyState title="Personel yok" subtitle="İlk personeli ekleyin" /> :
       <Card className="overflow-hidden">
         <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Personel ara…" /></div>
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-800">
               <tr className="text-left text-xs text-ink-400 dark:text-ink-400 uppercase tracking-wide">
                 <th className="px-4 py-3 font-semibold">Personel</th>
                 <th className="px-4 py-3 font-semibold">Rol</th>
                 <th className="px-4 py-3 font-semibold">Şube</th>
                 <th className="px-4 py-3 font-semibold">İletişim</th>
                 <th className="px-4 py-3 font-semibold">İşe Başlama</th>
                 <th className="px-4 py-3 font-semibold">Durum</th>
                 <th className="px-4 py-3"></th>
               </tr>
             </thead>
             <tbody>
               {paged.map(e => (
                 <tr key={e.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                   <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-cream-200 dark:bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-600 dark:text-ink-300">{e.full_name?.charAt(0).toUpperCase()}</div><span className="font-semibold text-ink-900 dark:text-ink-100">{e.full_name}</span></div></td>
                   <td className="px-4 py-3.5"><Badge tone="neutral">{roleLabels[e.role] ?? e.role}</Badge></td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">{stores.find(s => s.id === e.store_id)?.name ?? e.store_id ?? '—'}</td>
                   <td className="px-4 py-3.5 text-ink-400 dark:text-ink-400 text-xs">{e.phone || e.email || '—'}</td>
                   <td className="px-4 py-3.5 text-ink-400 dark:text-ink-400 text-xs">{e.hire_date ? formatDate(e.hire_date) : '—'}</td>
                   <td className="px-4 py-3.5"><Badge tone={e.is_active ? 'green' : 'neutral'}>{e.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
                   <td className="px-4 py-3.5"><div className="flex gap-1"><button onClick={() => setEditing(e)} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 flex items-center justify-center"><Edit2 size={14} className="text-ink-600 dark:text-ink-300" /></button><button onClick={() => setConfirmDel(e)} className="h-8 w-8 rounded-lg hover:bg-ex-100 flex items-center justify-center"><Trash2 size={14} className="text-ex-red" /></button></div></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
         {totalPages > 1 && <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />}
       </Card>
      }

      <EmployeeModal open={editing !== null || creating} employee={editing} stores={stores}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Personeli Sil" message={`"${confirmDel?.full_name ?? ''}" silinsin mi?`} />
    </div>
  );
}

function EmployeeModal({ open, employee, stores, onClose, onSaved }: { open: boolean; employee: Employee | null; stores: Store[]; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(employee ? { ...employee } : { full_name: '', role: 'barista', is_active: true });
  }, [open, employee]);
  const save = async () => {
    setSaving(true);
    try { if (employee) await updateEmployee(employee.id, form); else await createEmployee(form); onSaved(); toastSuccess('Kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={employee ? 'Personel Düzenle' : 'Yeni Personel'}>
      <div className="space-y-4">
        <div><label className="admin-label">Ad Soyad</label><input className="admin-input" value={form.full_name ?? ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="admin-label">Rol</label><select className="admin-input" value={form.role ?? 'barista'} onChange={e => setForm(f => ({ ...f, role: e.target.value as Employee['role'] }))}><option value="manager">Müdür</option><option value="shift_lead">Vardiya Lideri</option><option value="barista">Barista</option><option value="cashier">Kasiyer</option><option value="kitchen">Mutfak</option></select></div>
          <div><label className="admin-label">Şube</label><select className="admin-input" value={form.store_id ?? ''} onChange={e => setForm(f => ({ ...f, store_id: e.target.value || null }))}><option value="">—</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="admin-label">Telefon</label><input className="admin-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className="admin-label">E-posta</label><input className="admin-input" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <div><label className="admin-label">İşe Başlama</label><input type="date" className="admin-input" value={form.hire_date ?? ''} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} /></div>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif</label>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
