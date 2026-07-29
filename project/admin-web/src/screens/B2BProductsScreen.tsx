import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, PackageOpen, RefreshCw, Boxes,
  Tag, TrendingDown,
} from 'lucide-react';
import {
  fetchB2BProducts, createB2BProduct, updateB2BProduct, deleteB2BProduct,
  fetchB2BWarehouses, fetchB2BProductStock, upsertB2BProductStock,
} from '../lib/api';
import {
  Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader,
  Modal, SearchInput, Pagination, ConfirmDialog,
} from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatTRY } from '../lib/utils';
import type { B2BProduct, B2BWarehouse, B2BProductStock } from '../lib/supabase';

const PAGE_SIZE = 12;
const CATEGORIES = ['Genel', 'Çekirdek Kahve', 'Süt Ürünleri', 'Şurup', 'Tatlılar', 'Sarf Malzeme', 'Ekipman', 'Bakliyat'];
const UNITS = ['adet', 'kg', 'lt', 'paket', 'kutu', 'gram'];

export function B2BProductsScreen() {
  const [products, setProducts] = useState<B2BProduct[] | null>(null);
  const [warehouses, setWarehouses] = useState<B2BWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<B2BProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<B2BProduct | null>(null);
  const [stockProduct, setStockProduct] = useState<B2BProduct | null>(null);
  const { success, error: toastError } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, w] = await Promise.all([fetchB2BProducts(), fetchB2BWarehouses()]);
      setProducts(p);
      setWarehouses(w.filter((wh: B2BWarehouse) => wh.is_active));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'B2B ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (products ?? []).filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase());
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesQuery && matchesCat;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const categories = ['all', ...CATEGORIES];

  const toggleActive = async (p: B2BProduct) => {
    try {
      await updateB2BProduct(p.id, { is_active: !p.is_active });
      setProducts(prev => prev?.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x) ?? null);
      success(p.is_active ? 'Ürün pasifleştirildi' : 'Ürün aktifleştirildi');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const remove = async (p: B2BProduct) => {
    try {
      await deleteB2BProduct(p.id);
      setProducts(prev => prev?.filter(x => x.id !== p.id) ?? null);
      success('Ürün silindi');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  return (
    <div>
      <PageHeader
        title="B2B Ürün Yönetimi"
        subtitle="Franchise tedarik kataloğunu yönetin"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Ürün</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Ürün adı veya SKU ara…" />
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => { setCategoryFilter(c); setPage(1); }}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === c
                  ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
                  : 'bg-white border border-ink-100 text-ink-500 hover:bg-cream-50 dark:bg-ink-800 dark:border-ink-700 dark:text-ink-400'
              }`}
            >
              {c === 'all' ? 'Tümü' : c}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /></Button>
      </div>

      {loading ? <Spinner label="B2B ürünler yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       filtered.length === 0 ? <EmptyState title="Ürün bulunamadı" subtitle="Yeni B2B ürün ekleyin" /> :
       <>
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
           {pageItems.map(p => (
             <Card key={p.id} className="overflow-hidden">
               <div className="relative h-36 bg-cream-100 dark:bg-ink-800">
                 {p.image_url ? (
                   <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                 ) : (
                   <div className="h-full w-full flex items-center justify-center">
                     <PackageOpen size={32} className="text-ink-300 dark:text-ink-600" />
                   </div>
                 )}
                 <div className="absolute top-2 right-2 flex gap-1.5">
                   {p.campaign_price !== null && <Badge tone="red"><TrendingDown size={10} className="mr-0.5" /> Kampanya</Badge>}
                   {!p.is_active && <Badge tone="neutral">Pasif</Badge>}
                 </div>
               </div>
               <div className="p-4">
                 <p className="text-sm font-bold text-ink-900 dark:text-ink-100 truncate">{p.name}</p>
                 <p className="text-[11px] text-ink-400 mt-0.5 font-mono">{p.sku}</p>
                 <div className="flex items-center gap-1.5 mt-1">
                   <Badge tone="blue"><Tag size={9} className="mr-0.5" />{p.category}</Badge>
                   <span className="text-[11px] text-ink-400">{p.unit}</span>
                 </div>
                 <div className="flex items-center justify-between mt-3">
                   <div>
                     <span className="text-base font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(p.price))}</span>
                     {p.campaign_price !== null && (
                       <span className="text-xs text-ink-400 line-through ml-1.5">{formatTRY(Number(p.price))}</span>
                     )}
                   </div>
                   <span className="text-[11px] text-ink-400">KDV %{p.vat_rate}</span>
                 </div>
                 <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
                   <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(p)}>
                     <Edit2 size={13} /> Düzenle
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setStockProduct(p)} title="Stok yönet">
                     <Boxes size={14} />
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} title={p.is_active ? 'Pasifleştir' : 'Aktifleştir'}>
                     {p.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                   </Button>
                   <Button variant="danger" size="sm" onClick={() => setConfirmDelete(p)}>
                     <Trash2 size={13} />
                   </Button>
                 </div>
               </div>
             </Card>
           ))}
         </div>
         <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
       </>
      }

      <B2BProductFormModal
        open={editing !== null || creating}
        product={editing}
        warehouses={warehouses}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Ürünü Sil"
        message={`"${confirmDelete?.name}" ürününü kalıcı olarak silmek istediğinize emin misiniz?`}
      />

      {stockProduct && (
        <StockModal
          product={stockProduct}
          warehouses={warehouses}
          onClose={() => setStockProduct(null)}
          onSaved={async () => { setStockProduct(null); await load(); }}
        />
      )}
    </div>
  );
}

// ─── Product Form Modal ─────────────────────────────────────

function B2BProductFormModal({ open, product, warehouses, onClose, onSaved }: {
  open: boolean;
  product: B2BProduct | null;
  warehouses: B2BWarehouse[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<B2BProduct>>({});
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm(product ? { ...product } : {
        sku: '', name: '', description: '', image_url: '', category: 'Genel',
        unit: 'adet', price: 0, vat_rate: 10, min_order_qty: 1, is_active: true,
        campaign_label: '', campaign_price: null, campaign_ends: null,
        default_warehouse_id: null, sort_order: 0,
      });
    }
  }, [open, product]);

  const save = async () => {
    if (!form.sku?.trim() || !form.name?.trim()) {
      toastError('SKU ve ürün adı zorunludur');
      return;
    }
    setSaving(true);
    try {
      if (product) {
        await updateB2BProduct(product.id, form);
        success('Ürün güncellendi');
      } else {
        await createB2BProduct(form);
        success('Ürün oluşturuldu');
      }
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'B2B Ürünü Düzenle' : 'Yeni B2B Ürünü'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="admin-label">SKU (Ürün Kodu)</label><input className="admin-input" value={form.sku ?? ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Örn: CFR-250G" /></div>
        <div><label className="admin-label">Ürün Adı</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label className="admin-label">Kategori</label>
          <select className="admin-input" value={form.category ?? 'Genel'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="admin-label">Birim</label>
          <select className="admin-input" value={form.unit ?? 'adet'} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div><label className="admin-label">Fiyat (₺)</label><input type="number" step="0.01" className="admin-input" value={form.price ?? 0} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">KDV Oranı (%)</label><input type="number" step="1" className="admin-input" value={form.vat_rate ?? 10} onChange={e => setForm(f => ({ ...f, vat_rate: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">Min. Sipariş Miktarı</label><input type="number" step="0.5" className="admin-input" value={form.min_order_qty ?? 1} onChange={e => setForm(f => ({ ...f, min_order_qty: Number(e.target.value) }))} /></div>
        <div><label className="admin-label">Sıralama</label><input type="number" className="admin-input" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
        <div className="col-span-2"><label className="admin-label">Görsel URL</label><input className="admin-input" value={form.image_url ?? ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" /></div>
        <div className="col-span-2"><label className="admin-label">Açıklama</label><textarea className="admin-input min-h-[70px]" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>

        <div className="col-span-2 mt-2">
          <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-2">Kampanya (Opsiyonel)</p>
        </div>
        <div><label className="admin-label">Kampanya Etiketi</label><input className="admin-input" value={form.campaign_label ?? ''} onChange={e => setForm(f => ({ ...f, campaign_label: e.target.value }))} placeholder="Örn: Yaz Kampanyası" /></div>
        <div><label className="admin-label">Kampanya Fiyatı (₺)</label><input type="number" step="0.01" className="admin-input" value={form.campaign_price ?? ''} onChange={e => setForm(f => ({ ...f, campaign_price: e.target.value ? Number(e.target.value) : null }))} /></div>
        <div><label className="admin-label">Kampanya Bitiş</label><input type="date" className="admin-input" value={form.campaign_ends ? form.campaign_ends.split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, campaign_ends: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
        <div><label className="admin-label">Varsayılan Depo</label>
          <select className="admin-input" value={form.default_warehouse_id ?? ''} onChange={e => setForm(f => ({ ...f, default_warehouse_id: e.target.value || null }))}>
            <option value="">Otomatik</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="col-span-2 flex gap-4 mt-1">
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
            <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif
          </label>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}

// ─── Stock Management Modal ─────────────────────────────────

function StockModal({ product, warehouses, onClose, onSaved }: {
  product: B2BProduct;
  warehouses: B2BWarehouse[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stockRows, setStockRows] = useState<{ warehouse_id: string; stock_qty: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (!warehouses.length) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const existing = await fetchB2BProductStock(product.id);
        const rows = warehouses.map(w => ({
          warehouse_id: w.id,
          stock_qty: existing.find((s: B2BProductStock) => s.warehouse_id === w.id)?.stock_qty ?? 0,
        }));
        setStockRows(rows);
      } catch {
        setStockRows(warehouses.map(w => ({ warehouse_id: w.id, stock_qty: 0 })));
      } finally {
        setLoading(false);
      }
    })();
  }, [product.id, warehouses]);

  const updateStock = (warehouseId: string, qty: number) => {
    setStockRows(prev => prev.map(r => r.warehouse_id === warehouseId ? { ...r, stock_qty: qty } : r));
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(
        stockRows.map(r => upsertB2BProductStock(product.id, r.warehouse_id, r.stock_qty)),
      );
      success('Stok güncellendi');
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Stok güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Stok Yönetimi — ${product.name}`} size="md">
      {loading ? <Spinner label="Stok yükleniyor…" /> : warehouses.length === 0 ? (
        <EmptyState title="Depo yok" subtitle="Önce bir depo ekleyin" />
      ) : (
        <div className="space-y-3">
          {stockRows.map((row, i) => (
            <div key={row.warehouse_id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50 dark:bg-ink-800">
              <Boxes size={18} className="text-ink-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{warehouses[i]?.name ?? 'Depo'}</p>
                <p className="text-[11px] text-ink-400">{product.unit} cinsinden</p>
              </div>
              <input
                type="number"
                step="0.5"
                className="admin-input w-28 text-right"
                value={row.stock_qty}
                onChange={e => updateStock(row.warehouse_id, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving || loading} onClick={save}>{saving ? 'Kaydediliyor…' : 'Stoku Kaydet'}</Button>
      </div>
    </Modal>
  );
}
