import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Plus, Search, Star, Edit2, Trash2, Coffee } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, TextArea, Select, Toggle } from '@/components/ui/Modal';
import { useAdmin, genId } from '@/context/AdminContext';
import { MENU_CATEGORIES } from '@/data';
import { formatPrice, cn } from '@/lib/utils';
import {
  mapRetailDbProductsToUi,
  mapRetailUiProductToDb,
  filterRetailProductsByCategory,
  filterRetailProductsBySearch,
} from '@shared/utils/products';
import { RETAIL_PRODUCT_BADGE_LABELS_ADMIN, RETAIL_SEARCH_PLACEHOLDERS, retailProductImageUrl } from '@shared/constants/products';
import type { RetailProductDbRow } from '@shared/types/products';
import type { Product as DbProduct } from '@/lib/supabase';
import type { Product, ProductOption } from '@/types';

const defaultSizes: ProductOption[] = [
  { id: 's', label: 'Küçük', priceModifier: 0 },
  { id: 'l', label: 'Büyük', priceModifier: 10 },
];

const defaultOpts: ProductOption[] = [
  { id: 'none', label: 'Standart', priceModifier: 0 },
];

const blankProduct = (): Product => ({
  id: genId('p'), name: '', category: MENU_CATEGORIES[0], description: '', price: 220,
  image: retailProductImageUrl(),
  rating: 4.5, popular: false, seasonal: false, calories: 0, allergens: [],
  sizes: defaultSizes, milks: defaultOpts, syrups: defaultOpts, toppings: defaultOpts,
  temperature: [{ id: 'hot', label: 'Sıcak', priceModifier: 0 }],
  iceLevels: ['Buz Yok'],
  nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0, caffeine: 0 },
});

export function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct } = useAdmin();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Tümü');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Product>(blankProduct());

  const typedProducts = mapRetailDbProductsToUi(products as unknown as RetailProductDbRow[]);

  const filtered = filterRetailProductsBySearch(
    filterRetailProductsByCategory(typedProducts, cat),
    query,
  );

  const openCreate = () => { setForm(blankProduct()); setCreating(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditing(p); };
  const closeForm = () => { setEditing(null); setCreating(false); };

  const set = <K extends keyof Product>(key: K, val: Product[K]) => setForm(f => ({ ...f, [key]: val }));

  const save = () => {
    if (!form.name.trim()) return;
    const dbForm = mapRetailUiProductToDb(form) as Partial<DbProduct>;
    if (creating) addProduct(dbForm);
    else if (editing) updateProduct(editing.id, dbForm);
    closeForm();
  };

  return (
    <View className="max-w-4xl w-full mx-auto gap-4">
      <View className="flex-row gap-3 items-center">
        <View className="flex-1 flex-row items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-ink-100">
          <Search size={18} color="#9494A0" />
          <RNTextInput value={query} onChangeText={setQuery} placeholder={RETAIL_SEARCH_PLACEHOLDERS.admin} placeholderTextColor="#9494A0" className="flex-1 text-sm text-ink-900" />
        </View>
        <Button variant="gold" onPress={openCreate}><Plus size={16} /> Ürün ekle</Button>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {['Tümü', ...MENU_CATEGORIES].map(c => (
          <Pressable key={c} onPress={() => setCat(c)} className={cn(
            'shrink-0 px-4 py-2 rounded-full border',
            cat === c ? 'bg-ink-900 border-ink-900' : 'bg-white border-ink-100',
          )}>
            <Text className={cn('text-xs font-medium', cat === c ? 'text-white' : 'text-ink-700')}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="flex-row flex-wrap gap-4">
        {filtered.map(p => (
          <View key={p.id} className="w-full sm:w-[48%]">
            <Card className="p-4">
              <View className="flex-row gap-3">
                <Image source={{ uri: p.image }} className="h-20 w-20 rounded-2xl shrink-0" resizeMode="cover" />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-ink-900 leading-tight" numberOfLines={2}>{p.name}</Text>
                  <Text className="text-[11px] text-ink-400 mt-0.5">{p.category}</Text>
                  <View className="flex-row items-center gap-2 mt-1.5">
                    <View className="flex-row items-center gap-0.5"><Star size={11} color="#E11D38" fill="#E11D38" /><Text className="text-[11px] text-ink-500">{p.rating}</Text></View>
                    <Text className="text-[11px] text-ink-400">· {p.calories} kal</Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-sm font-semibold text-ex-red">{formatPrice(p.price)}</Text>
                    <View className="flex-row gap-1">
                      {p.popular && <View className="px-1.5 py-0.5 rounded bg-ink-100"><Text className="text-[9px] font-bold text-ink-500">{RETAIL_PRODUCT_BADGE_LABELS_ADMIN.popular}</Text></View>}
                      {p.seasonal && <View className="px-1.5 py-0.5 rounded bg-red-50"><Text className="text-[9px] font-bold text-ex-red">{RETAIL_PRODUCT_BADGE_LABELS_ADMIN.seasonal}</Text></View>}
                    </View>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3 pt-3 border-t border-ink-100">
                <Button variant="outline" size="sm" full onPress={() => openEdit(p)}><Edit2 size={13} /> Düzenle</Button>
                <Button variant="ghost" size="sm" onPress={() => setConfirmDelete(p.id)}><Trash2 size={14} /></Button>
              </View>
            </Card>
          </View>
        ))}
      </View>

      {filtered.length === 0 && (
        <View className="py-16 items-center">
          <Coffee size={40} color="#E0E0E4" />
          <Text className="text-xl text-ink-400 mt-3">Ürün bulunamadı</Text>
        </View>
      )}

      <Modal open={creating || !!editing} onClose={closeForm} title={creating ? 'Yeni Ürün' : 'Ürünü Düzenle'}>
        <View className="gap-4">
          <FormField label="Ürün adı">
            <TextInput value={form.name} onChangeText={v => set('name', v)} placeholder="Örn. Americano" />
          </FormField>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField label="Kategori">
                <Select value={form.category} onValueChange={v => set('category', v)} options={MENU_CATEGORIES.map(c => ({ label: c, value: c }))} />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Fiyat (₺)">
                <TextInput value={String(form.price)} onChangeText={v => set('price', Number(v) || 0)} keyboardType="numeric" />
              </FormField>
            </View>
          </View>
          <FormField label="Açıklama">
            <TextArea value={form.description} onChangeText={v => set('description', v)} placeholder="Ürün açıklaması…" />
          </FormField>
          <FormField label="Görsel URL">
            <TextInput value={form.image} onChangeText={v => set('image', v)} placeholder="https://…" />
          </FormField>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Puan"><TextInput value={String(form.rating)} onChangeText={v => set('rating', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1"><FormField label="Kalori"><TextInput value={String(form.calories)} onChangeText={v => set('calories', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1"><FormField label="Alerjenler"><TextInput value={form.allergens.join(', ')} onChangeText={v => set('allergens', v.split(',').map(a => a.trim()).filter(Boolean))} placeholder="Süt, Kuruyemiş" /></FormField></View>
          </View>
          <View className="flex-row flex-wrap gap-6">
            <Toggle checked={form.popular} onChange={v => set('popular', v)} label="Popüler" />
            <Toggle checked={form.seasonal} onChange={v => set('seasonal', v)} label="Mevsimlik" />
            <Toggle checked={form.aiRecommended ?? false} onChange={v => set('aiRecommended', v)} label="AI önerisi" />
          </View>
          <View className="flex-row gap-3 pt-2">
            <Button variant="outline" full onPress={closeForm}>Vazgeç</Button>
            <Button variant="gold" full onPress={save} disabled={!form.name.trim()}>Kaydet</Button>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteProduct(confirmDelete)}
        title="Ürünü sil"
        message="Bu ürünü silmek istediğine emin misin? Bu işlem geri alınamaz."
      />
    </View>
  );
}
