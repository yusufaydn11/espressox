import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Crown } from 'lucide-react';
import { fetchRewards, createReward, updateReward, deleteReward } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Button, PageHeader, Modal, Badge, SearchInput, Pagination, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import type { Reward } from '../lib/supabase';

const PAGE_SIZE = 10;

export function RewardsScreen() {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Reward | null>(null);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const [form, setForm] = useState({ title: '', description: '', points_cost: 0, category: 'coffee', image: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRewards(await fetchRewards());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ödüller yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (rewards ?? []).filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase()),
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', points_cost: 0, category: 'coffee', image: '', is_active: true });
    setModalOpen(true);
  };
  const openEdit = (r: Reward) => {
    setEditing(r);
    setForm({ title: r.title, description: r.description ?? '', points_cost: r.points_cost, category: r.category, image: r.image ?? '', is_active: r.is_active });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateReward(editing.id, form);
        success('Ödül güncellendi');
      } else {
        await createReward(form);
        success('Ödül oluşturuldu');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReward(id);
      success('Ödül silindi');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  return (
    <div>
      <PageHeader
        title="Ödül Yönetimi"
        subtitle="Sadakat ödüllerini yönetin"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Yenile</Button>
            <Button size="sm" onClick={openCreate}><Plus size={14} /> Yeni Ödül</Button>
          </div>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Ödül adı veya kategori ara…" />
      </div>

      {loading ? <Spinner label="Ödüller yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !rewards || rewards.length === 0 ? <EmptyState title="Ödül bulunamadı" subtitle="Henüz sadakat ödülü tanımlanmamış" /> :
       <>
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
           {pageItems.map(r => (
             <Card key={r.id} className="p-5 flex flex-col">
               <div className="flex items-start justify-between mb-3">
                 <div className="h-12 w-12 rounded-xl bg-gold-gradient flex items-center justify-center">
                   <Crown size={22} color="#fff" />
                 </div>
                 <Badge tone={r.is_active ? 'green' : 'neutral'}>{r.is_active ? 'Aktif' : 'Pasif'}</Badge>
               </div>
               <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">{r.title}</h3>
               <p className="text-xs text-ink-400 mt-1 flex-1 line-clamp-2">{r.description || 'Açıklama yok'}</p>
               <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
                 <span className="text-xs font-bold text-amber-600">{r.points_cost} puan</span>
                 <div className="flex gap-1">
                   <button onClick={() => openEdit(r)} className="h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
                     <Edit2 size={14} />
                   </button>
                   <button onClick={() => setConfirmDelete(r)} className="h-8 w-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-ink-400 hover:text-ex-red">
                     <Trash2 size={14} />
                   </button>
                 </div>
               </div>
             </Card>
           ))}
         </div>
         <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
       </>
      }

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Ödül Düzenle' : 'Yeni Ödül'} size="md">
        <div className="space-y-4">
          <div>
            <label className="admin-label">Ödül Adı</label>
            <input className="admin-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ücretsiz Latte" />
          </div>
          <div>
            <label className="admin-label">Açıklama</label>
            <textarea className="admin-input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ödül açıklaması" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="admin-label">Puan Maliyeti</label>
              <input type="number" className="admin-input" value={form.points_cost} onChange={e => setForm({ ...form, points_cost: Number(e.target.value) })} />
            </div>
            <div>
              <label className="admin-label">Kategori</label>
              <select className="admin-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="coffee">Kahve</option>
                <option value="food">Yiyecek</option>
                <option value="merch">Ürün</option>
                <option value="discount">İndirim</option>
              </select>
            </div>
          </div>
          <div>
            <label className="admin-label">Görsel URL (opsiyonel)</label>
            <input className="admin-input" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded accent-ex-red" />
            <span className="text-sm text-ink-700 dark:text-ink-300">Aktif</span>
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button size="sm" onClick={save} disabled={saving || !form.title}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete.id)}
        title="Ödülü Sil"
        message={`"${confirmDelete?.title}" ödülünü silmek istediğinize emin misiniz?`}
      />
    </div>
  );
}
