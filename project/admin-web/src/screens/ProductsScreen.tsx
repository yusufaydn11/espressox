import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, PackageOpen, RefreshCw } from 'lucide-react';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchCategories } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, Pagination, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatTRY } from '../lib/utils';
import type { Product, Category } from '../lib/supabase';

const PAGE_SIZE = 12;

export function ProductsScreen() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const { success, error: toastError } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(p); setCategories(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ürünler yüklenemedi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products?.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) ?? [];
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleActive = async (p: Product) => {
    try { await updateProduct(p.id, { is_active: !p.is_active }); setProducts(prev => prev?.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x) ?? null); success(p.is_active ? 'Ürün gizlendi' : 'Ürün görünür yapıldı'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Güncellenemedi'); }
  };

  const remove = async (p: Product) => {
    try { await deleteProduct(p.id); setProducts(prev => prev?.filter(x => x.id !== p.id) ?? null); success('Ürün silindi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  return (
    <div>
      <PageHeader title="Ürün Yönetimi" subtitle="Menüdeki tüm ürünleri yönetin"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Ürün</Button>} />

      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Ürün ara…" />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /></Button>
      </div>

      {loading ? <Spinner label="Ürünler yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       filtered.length === 0 ? <EmptyState title="Ürün yok" subtitle="Yeni ürün ekleyin" /> :
       <>
       <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
         {pageItems.map(p => (
           <Card key={p.id} className="overflow-hidden">
             <div className="relative h-36 bg-cream-100 dark:bg-ink-800">
               {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><PackageOpen size={32} className="text-ink-300 dark:text-ink-600" /></div>}
               <div className="absolute top-2 right-2 flex gap-1.5">
                 {p.popular && <Badge tone="red">Popüler</Badge>}
                 {!p.is_active && <Badge tone="neutral">Gizli</Badge>}
               </div>
             </div>
             <div className="p-4">
               <p className="text-sm font-bold text-ink-900 dark:text-ink-100 truncate">{p.name}</p>
               <p className="text-xs text-ink-400 mt-0.5">{p.category}</p>
               <div className="flex items-center justify-between mt-3">
                 <div>
                   <span className="text-base font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(p.price))}</span>
                   {p.discount_price && <span className="text-xs text-ink-400 line-through ml-1.5">{formatTRY(Number(p.discount_price))}</span>}
                 </div>
               </div>
               <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
                 <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(p)}><Edit2 size={13} /> Düzenle</Button>
                 <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} title={p.is_active ? 'Gizle' : 'Göster'}>
                   {p.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                 </Button>
                 <Button variant="danger" size="sm" onClick={() => setConfirmDelete(p)}><Trash2 size={13} /></Button>
               </div>
             </div>
           </Card>
         ))}
       </div>
       <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
       </>
      }

      <ProductFormModal open={editing !== null || creating} product={editing} categories={categories}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Ürünü Sil"
        message={`"${confirmDelete?.name}" ürününü silmek istediğinize emin misiniz?`}
      />
    </div>
  );
}

function ProductFormModal({ open, product, categories, onClose, onSaved }: {
  open: boolean; product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(product ? { ...product } : { name: '', category: '', description: '', price: 0, image: '', calories: 0, is_active: true, in_stock: true, popular: false, seasonal: false, allergens: [], sort_order: 0 });
  }, [open, product]);

  const save = async () => {
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, form);
      else await createProduct({ ...form, id: `p${Date.now()}`, rating: 4.5, ai_recommended: false, sizes: [], milks: [], syrups: [], toppings: [], temperature: [], ice_levels: [], nutrition: { calories: form.calories ?? 0, fat: 0, carbs: 0, protein: 0, caffeine: 0 } });
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Ürünü Düzenle' : 'Yeni Ürün'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="admin-label">Ürün Adı</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label className="admin-label">Kategori</label>
          <select className="admin-input" value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value, category_id: e.target.value || null }))}>
            <option value="">Seçiniz</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="Espresso">Espresso</option><option value="Latte">Latte</option><option value="Cold Brew">Cold Brew</option>
            <option value="Tatlılar">Tatlılar</option><option value="Kahvaltı">Kahvaltı</option>
          </select>
        </div>
        <div><label className="admin-label">Fiyat (₺)</label><input type="number" className="admin-input" value={form.price ?? 0} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">İndirimli Fiyat (₺)</label><input type="number" className="admin-input" value={form.discount_price ?? ''} onChange={e => setForm(f => ({ ...f, discount_price: e.target.value ? Number(e.target.value) : null }))} /></div>
        <div><label className="admin-label">Kalori</label><input type="number" className="admin-input" value={form.calories ?? 0} onChange={e => setForm(f => ({ ...f, calories: Number(e.target.value) }))} /></div>
        <div className="col-span-2"><label className="admin-label">Görsel URL</label><input className="admin-input" value={form.image ?? ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://…" /></div>
        <div className="col-span-2"><label className="admin-label">Açıklama</label><textarea className="admin-input min-h-[80px]" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="col-span-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif</label>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.popular ?? false} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} /> Popüler</label>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.seasonal ?? false} onChange={e => setForm(f => ({ ...f, seasonal: e.target.checked }))} /> Mevsimlik</label>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
