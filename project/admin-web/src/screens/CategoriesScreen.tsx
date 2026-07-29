import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, FolderTree } from 'lucide-react';
import { fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, Pagination, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import type { Category } from '../lib/supabase';

export function CategoriesScreen() {
  const { success, error: toastError } = useToast();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCats(await fetchCategories()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kategoriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (c: Category, dir: -1 | 1) => {
    if (!cats) return;
    const idx = cats.findIndex(x => x.id === c.id);
    const swap = cats[idx + dir];
    if (!swap) return;
    const reordered = cats.map(x => {
      if (x.id === c.id) return { id: x.id, sort_order: swap.sort_order };
      if (x.id === swap.id) return { id: x.id, sort_order: c.sort_order };
      return { id: x.id, sort_order: x.sort_order };
    });
    setCats(cats.map(x => reordered.find(r => r.id === x.id) ? { ...x, sort_order: reordered.find(r => r.id === x.id)!.sort_order } : x));
    try { await reorderCategories(reordered); await load(); success('Sıralama güncellendi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Sıralama değiştirilemedi'); }
  };

  const toggleActive = async (c: Category) => {
    try { await updateCategory(c.id, { is_active: !c.is_active }); setCats(prev => prev?.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x) ?? null); success('Güncellendi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Güncellenemedi'); }
  };

  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  const filteredCats = (cats ?? []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredCats.length / PAGE_SIZE);
  const pagedCats = filteredCats.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const remove = async (c: Category) => {
    try { await deleteCategory(c.id); setCats(prev => prev?.filter(x => x.id !== c.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  return (
    <div>
      <PageHeader title="Kategori Yönetimi" subtitle="Menü kategorilerini sıralayın ve yönetin"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Kategori</Button>} />

      {loading ? <Spinner label="Yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !cats || cats.length === 0 ? <EmptyState title="Kategori yok" subtitle="İlk kategoriyi ekleyin" /> :
       <>
       <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Kategori ara…" /></div>
       <Card className="overflow-hidden">
         <table className="w-full text-sm">
           <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-800">
             <tr className="text-left text-xs text-ink-400 dark:text-ink-400 uppercase tracking-wide">
               <th className="px-4 py-3 font-semibold w-16">Sıra</th>
               <th className="px-4 py-3 font-semibold">Kategori</th>
               <th className="px-4 py-3 font-semibold">Durum</th>
               <th className="px-4 py-3 font-semibold w-32">İşlemler</th>
             </tr>
           </thead>
           <tbody>
             {pagedCats.map((c, i) => (
               <tr key={c.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                 <td className="px-4 py-3.5 text-ink-400 dark:text-ink-400 font-mono text-xs">{c.sort_order}</td>
                 <td className="px-4 py-3.5 font-semibold text-ink-900 dark:text-ink-100 flex items-center gap-2">
                   <FolderTree size={15} className="text-ink-400 dark:text-ink-400" /> {c.name}
                 </td>
                 <td className="px-4 py-3.5">
                   <button onClick={() => toggleActive(c)}>
                     <Badge tone={c.is_active ? 'green' : 'neutral'}>{c.is_active ? 'Aktif' : 'Pasif'}</Badge>
                   </button>
                 </td>
                 <td className="px-4 py-3.5">
                   <div className="flex items-center gap-1">
                     <button onClick={() => move(c, -1)} disabled={i === 0} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 flex items-center justify-center disabled:opacity-30"><ArrowUp size={14} className="text-ink-600 dark:text-ink-300" /></button>
                     <button onClick={() => move(c, 1)} disabled={i === pagedCats.length - 1} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 flex items-center justify-center disabled:opacity-30"><ArrowDown size={14} className="text-ink-600 dark:text-ink-300" /></button>
                     <button onClick={() => setEditing(c)} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 flex items-center justify-center"><Edit2 size={14} className="text-ink-600 dark:text-ink-300" /></button>
                     <button onClick={() => setConfirmDel(c)} className="h-8 w-8 rounded-lg hover:bg-ex-100 flex items-center justify-center"><Trash2 size={14} className="text-ex-red" /></button>
                   </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </Card>
       {totalPages > 1 && <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />}
       </>
      }

      <CategoryModal open={editing !== null || creating} category={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Kategoriyi Sil" message={`"${confirmDel?.name ?? ''}" silinsin mi?`} />
    </div>
  );
}

function CategoryModal({ open, category, onClose, onSaved }: { open: boolean; category: Category | null; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Category>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(category ? { ...category } : { id: '', name: '', icon: null, sort_order: 0, is_active: true });
  }, [open, category]);

  const save = async () => {
    setSaving(true);
    try {
      const id = form.id || form.name!.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (category) await updateCategory(category.id, form);
      else await createCategory({ ...form, id });
      onSaved(); toastSuccess('Kaydedildi');
    } catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Kategori Düzenle' : 'Yeni Kategori'}>
      <div className="space-y-4">
        <div><label className="admin-label">Kategori Adı</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label className="admin-label">İkon (opsiyonel)</label><input className="admin-input" value={form.icon ?? ''} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="Coffee" /></div>
        <div><label className="admin-label">Sıra</label><input type="number" className="admin-input" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif</label>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
