import type {
  Product, Store, Reward, Challenge, Badge, Order,
  Promotion, PaymentMethod, Customer, AdminCustomer, AdminOrder,
  Employee, Campaign, ChartPoint,
} from '@/types';

const img = (id: string, w = 800) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

// ─── Products ─────────────────────────────────────────────
const sizes = () => [
  { id: 's', label: 'Küçük', priceModifier: 0 },
  { id: 'l', label: 'Büyük', priceModifier: 10 },
];

const milks = [
  { id: 'whole', label: 'Tam Yağlı Süt', priceModifier: 0 },
  { id: 'skim', label: 'Yağsız Süt', priceModifier: 0 },
  { id: 'oat', label: 'Yulaf Sütü', priceModifier: 0.6 },
  { id: 'almond', label: 'Badem Sütü', priceModifier: 0.6 },
  { id: 'soy', label: 'Soya Sütü', priceModifier: 0.5 },
  { id: 'coconut', label: 'Hindistan Cevizi Sütü', priceModifier: 0.6 },
];

const syrups = [
  { id: 'none', label: 'Şurup Yok', priceModifier: 0 },
  { id: 'vanilla', label: 'Vanilya', priceModifier: 0.5 },
  { id: 'caramel', label: 'Karamel', priceModifier: 0.5 },
  { id: 'hazelnut', label: 'Fındık', priceModifier: 0.5 },
  { id: 'pistachio', label: 'Antep Fıstığı', priceModifier: 0.7 },
  { id: 'lavender', label: 'Lavanta Balı', priceModifier: 0.7 },
  { id: 'brown-sugar', label: 'Kahverengi Şeker', priceModifier: 0.5 },
];

const toppings = [
  { id: 'none', label: 'Ekstra Yok', priceModifier: 0 },
  { id: 'whip', label: 'Krema', priceModifier: 0.6 },
  { id: 'caramel-drizzle', label: 'Karamel Sos', priceModifier: 0.5 },
  { id: 'cocoa', label: 'Kakao', priceModifier: 0.3 },
  { id: 'cinnamon', label: 'Tarçın', priceModifier: 0.3 },
  { id: 'gold-leaf', label: 'Altın Yaprak', priceModifier: 2.5 },
];

const temps = [
  { id: 'hot', label: 'Sıcak', priceModifier: 0 },
  { id: 'iced', label: 'Buzlu', priceModifier: 0 },
  { id: 'blended', label: 'Blended', priceModifier: 0.8 },
];

const iceLevels = ['Buz Yok', 'Az Buzlu', 'Normal', 'Ekstra Buzlu', 'Blended'];

export const PRODUCTS: Product[] = [
  {
    id: 'p1', name: 'Velvet Gold Espresso', category: 'Espresso',
    description: 'Tek menşeili Etiyopya çekirdeklerinden çekilen imza double shot espressomuz, altın rengi krema ile taçlandırılmış.',
    price: 220, image: img('302899'), rating: 4.9, popular: true, seasonal: false,
    calories: 10, allergens: [], sizes: sizes(), milks, syrups, toppings, temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 10, fat: 0, carbs: 1, protein: 0, caffeine: 150 },
  },
  {
    id: 'p2', name: 'Kakule Latte', category: 'Latte',
    description: 'Zengin espresso tabanı üzerine kavrulmuş kakule tohumları ile buharlaştırılan ipeksi mikro köpük. Ev imzası.',
    price: 220, image: img('302901'), rating: 4.8, popular: true, seasonal: true, aiRecommended: true,
    calories: 180, allergens: ['Süt'],
    sizes: sizes(), milks, syrups, toppings, temperature: temps, iceLevels,
    nutrition: { calories: 180, fat: 7, carbs: 18, protein: 8, caffeine: 154 },
  },
  {
    id: 'p3', name: 'Bal Peteği Cappuccino', category: 'Cappuccino',
    description: 'Klasik 1:1:1 espresso, buharlaştırılmış süt ve sıkı köpük, yaban çiçeği bal peteği şurubu ile öpülmüş.',
    price: 220, image: img('2074130'), rating: 4.7, popular: true, seasonal: false,
    calories: 140, allergens: ['Süt'],
    sizes: sizes(), milks, syrups, toppings, temperature: [temps[0], temps[1]], iceLevels,
    nutrition: { calories: 140, fat: 5, carbs: 16, protein: 7, caffeine: 150 },
  },
  {
    id: 'p4', name: 'Gece Yarısı Cold Brew', category: 'Cold Brew',
    description: 'Olağanüstü pürüzsüz, düşük asiditeli, bitter çikolata notalarına sahip bir fincan için soğuk kaynak suda 20 saat demlendi.',
    price: 220, image: img('894695'), rating: 4.9, popular: true, seasonal: false, aiRecommended: true,
    calories: 15, allergens: [],
    sizes: sizes(), milks, syrups, toppings, temperature: [temps[1]], iceLevels,
    nutrition: { calories: 15, fat: 0, carbs: 2, protein: 1, caffeine: 220 },
  },
  {
    id: 'p5', name: 'Filtre Kahve', category: 'Filtre Kahve',
    description: 'Tek menşeili Kolombiya kavrumu, küçük partiler halinde el ile dökülerek demlenir. Parlak sitrus, temiz bitiş.',
    price: 220, image: img('414645'), rating: 4.6, popular: false, seasonal: false,
    calories: 5, allergens: [],
    sizes: sizes(), milks, syrups, toppings, temperature: [temps[0]], iceLevels: ['Buz Yok'],
    nutrition: { calories: 5, fat: 0, carbs: 1, protein: 0, caffeine: 145 },
  },
  {
    id: 'p6', name: 'Matcha Reserve', category: 'Matcha',
    description: 'Seremoni kalite Uji matcha, kadifemsi buharlaştırılmış süt ile çırpılır. Taş öğütülmüş, ilk hasat.',
    price: 220, image: img('2304771'), rating: 4.8, popular: true, seasonal: false, aiRecommended: true,
    calories: 120, allergens: ['Süt'],
    sizes: sizes(), milks, syrups, toppings, temperature: temps, iceLevels,
    nutrition: { calories: 120, fat: 4, carbs: 14, protein: 6, caffeine: 70 },
  },
  {
    id: 'p7', name: 'Yuzu Fizzy Yenileyici', category: 'Yenileyiciler',
    description: 'Japon yuzu ve yeşil çay, buz üzerinde, köpüklü maden suyu ile. Crisp ve parlak.',
    price: 220, image: img('2599295'), rating: 4.5, popular: false, seasonal: true,
    calories: 90, allergens: [],
    sizes: sizes(), milks: [milks[0]], syrups: [syrups[0]], toppings, temperature: [temps[1]], iceLevels,
    nutrition: { calories: 90, fat: 0, carbs: 22, protein: 0, caffeine: 35 },
  },
  {
    id: 'p8', name: 'Safran Gül Latte', category: 'Latte',
    description: 'İran safranı ve gül suyu ile demlenmiş buharlaştırılmış süt. Espresso X özel üretimi.',
    price: 220, image: img('7651785'), rating: 4.9, popular: true, seasonal: true, aiRecommended: true,
    calories: 200, allergens: ['Süt'],
    sizes: sizes(), milks, syrups, toppings, temperature: temps, iceLevels,
    nutrition: { calories: 200, fat: 8, carbs: 22, protein: 9, caffeine: 154 },
  },
  {
    id: 'p9', name: 'Kara Orman Mocha', category: 'Kahve',
    description: 'Double espresso, %70 Venezuelalı bitter çikolata, buharlaştırılmış süt ve kakao kenarlı bardak.',
    price: 220, image: img('544961'), rating: 4.7, popular: true, seasonal: false,
    calories: 260, allergens: ['Süt', 'Soya'],
    sizes: sizes(), milks, syrups, toppings, temperature: temps, iceLevels,
    nutrition: { calories: 260, fat: 11, carbs: 32, protein: 10, caffeine: 165 },
  },
  {
    id: 'p10', name: 'Antep Fıstığı Affogato', category: 'Tatlılar',
    description: 'İki top Antep fıstığı dondurması, taze çekilmiş espresso shot içinde boğulmuş. Şatafatlı.',
    price: 120, image: img('1855214'), rating: 4.9, popular: true, seasonal: false,
    calories: 320, allergens: ['Süt', 'Kuruyemiş'],
    sizes: [{ id: 's', label: 'Tekli', priceModifier: 0 }, { id: 'm', label: 'İkili', priceModifier: 45 }],
    milks, syrups, toppings, temperature: [temps[0]], iceLevels: ['Buz Yok'],
    nutrition: { calories: 320, fat: 16, carbs: 38, protein: 8, caffeine: 75 },
  },
  {
    id: 'p11', name: 'Bademli Kruvasan', category: 'Unlu Mamuller',
    description: 'Tam yağlı tereyağlı milföy hamuru, frangipane dolgulu, kavrulmuş badem ve pudra şekeri ile.',
    price: 75, image: img('2135'), rating: 4.6, popular: true, seasonal: false,
    calories: 380, allergens: ['Buğday', 'Süt', 'Kuruyemiş', 'Yumurta'],
    sizes: [{ id: 's', label: 'Standart', priceModifier: 0 }],
    milks: [milks[0]], syrups: [syrups[0]], toppings: [toppings[0]], temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 380, fat: 22, carbs: 40, protein: 8, caffeine: 0 },
  },
  {
    id: 'p12', name: 'Trüflü Yumurtalı Sandviç', category: 'Sandviçler',
    description: 'Serbest dolaşan haşlanmış yumurta, kara trüflü aioli ve yaşlı çedar, brioche ekmek üzerinde.',
    price: 135, image: img('1647163'), rating: 4.7, popular: false, seasonal: false,
    calories: 440, allergens: ['Buğday', 'Süt', 'Yumurta'],
    sizes: [{ id: 's', label: 'Standart', priceModifier: 0 }],
    milks: [milks[0]], syrups: [syrups[0]], toppings: [toppings[0]], temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 440, fat: 24, carbs: 36, protein: 22, caffeine: 0 },
  },
  {
    id: 'p13', name: 'Avokadolu Tost', category: 'Kahvaltı',
    description: 'Ezilmiş avokado, haşlanmış yumurta, acı bal ve micro yeşillikler, ekşi maya üzerinde.',
    price: 145, image: img('1351238'), rating: 4.8, popular: true, seasonal: false,
    calories: 350, allergens: ['Buğday', 'Yumurta'],
    sizes: [{ id: 's', label: 'Standart', priceModifier: 0 }],
    milks: [milks[0]], syrups: [syrups[0]], toppings: [toppings[0]], temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 350, fat: 19, carbs: 30, protein: 14, caffeine: 0 },
  },
  {
    id: 'p14', name: 'Espresso X Termos', category: 'Ürünler',
    description: 'El ile işlenmiş mat siyah vakum termos, 24k altın foil monogram ile. Sıcak 8s, soğuk 24s tutar.',
    price: 650, image: img('1188649'), rating: 5.0, popular: false, seasonal: false,
    calories: 0, allergens: [],
    sizes: [{ id: 's', label: '12oz', priceModifier: 0 }, { id: 'm', label: '16oz', priceModifier: 120 }],
    milks: [milks[0]], syrups: [syrups[0]], toppings: [toppings[0]], temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0, caffeine: 0 },
  },
  {
    id: 'p15', name: 'Etiyopya Yirgacheffe Çekirdek', category: 'Kahve Çekirdeği',
    description: '250g tam çekirdek. Yasemin, bergamot ve taş meyve notaları. Açık kavrum, tek menşe.',
    price: 380, image: img('4109744'), rating: 4.9, popular: true, seasonal: false,
    calories: 0, allergens: [],
    sizes: [{ id: 's', label: '250g', priceModifier: 0 }, { id: 'm', label: '500g', priceModifier: 280 }],
    milks: [milks[0]], syrups: [syrups[0]], toppings: [toppings[0]], temperature: [temps[0]],
    iceLevels: ['Buz Yok'],
    nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0, caffeine: 0 },
  },
  {
    id: 'p16', name: 'Sencha Çay', category: 'Çay',
    description: 'İlk hasat Japon sencha, buharda pişirilip rulo yapılmış. Vejetal, tatlı ve derin yeşil.',
    price: 220, image: img('1638280'), rating: 4.4, popular: false, seasonal: false,
    calories: 5, allergens: [],
    sizes: sizes(), milks, syrups, toppings, temperature: [temps[0]], iceLevels: ['Buz Yok'],
    nutrition: { calories: 5, fat: 0, carbs: 1, protein: 0, caffeine: 40 },
  },
];

export const MENU_CATEGORIES = [
  'Kahveler', 'Espresso', 'Çay', 'Soğuk Kahveler', 'Özel İçecekler',
  'Matcha', 'Creamy', 'Refreshss', 'Frozen', 'Frappe', 'Bubble', 'Yeni',
  'Pastalar', 'Soğuk İçecekler', 'Paket', 'Sandviç', 'Atıştırmalık',
];

// ─── Stores ─────────────────────────────────────────────
export const STORES: Store[] = [
  { id: 's1', name: 'Nişantaşı Mağaza', address: 'Teşvikiye Cd. No:12, Şişli, İstanbul', distance: 0.4, open: true, hours: '07:00 – 22:00', busy: 'moderate', amenities: ['WiFi', 'Otopark', 'Drive-thru'], lat: 41.0510, lng: 29.0078, driveThru: true, wifi: true, parking: true },
  { id: 's2', name: 'Kadıköy Moda', address: 'Moda Cd. No:43, Kadıköy, İstanbul', distance: 1.2, open: true, hours: '07:00 – 21:00', busy: 'busy', amenities: ['WiFi'], lat: 40.9798, lng: 29.0247, driveThru: false, wifi: true, parking: false },
  { id: 's3', name: 'Beşiktaş İskele', address: 'Cumhuriyet Cd. No:5, Beşiktaş, İstanbul', distance: 2.1, open: true, hours: '06:30 – 23:00', busy: 'quiet', amenities: ['WiFi', 'Otopark'], lat: 41.0426, lng: 29.0034, driveThru: false, wifi: true, parking: true },
  { id: 's4', name: 'Karaköy Lokalı', address: 'Kemankeş Cd. No:1, Beyoğlu, İstanbul', distance: 2.8, open: false, hours: '07:00 – 20:00', busy: 'moderate', amenities: ['WiFi'], lat: 41.0250, lng: 28.9744, driveThru: false, wifi: true, parking: false },
  { id: 's5', name: 'Bakırköy Meydan', address: 'İstasyon Cd. No:88, Bakırköy, İstanbul', distance: 3.4, open: true, hours: '07:00 – 22:30', busy: 'busy', amenities: ['WiFi', 'Otopark', 'Drive-thru'], lat: 40.9722, lng: 28.8744, driveThru: true, wifi: true, parking: true },
];

// ─── Loyalty ─────────────────────────────────────────────
export { TIERS } from '@shared/constants/loyalty';

export const REWARDS: Reward[] = [
  { id: 'r1', title: 'Herhangi Bir El Yapımı Kahve', description: 'Herhangi bir boyutta kahve veya espresso içeceğinde kullanın.', pointsCost: 150, category: 'coffee', image: img('302899') },
  { id: 'r2', title: 'Ücretsiz Tatlı', description: 'Vitrinimizden herhangi bir tatlı seçin.', pointsCost: 200, category: 'dessert', image: img('1855214') },
  { id: 'r3', title: 'Tüm Siparişte %25 İndirim', description: 'Bir sonraki siparişinizde tek seferlik %25 indirim.', pointsCost: 300, category: 'discount', image: img('312428') },
  { id: 'r4', title: 'Rose Latte', description: 'Özel imza içeceğimizin kilidini açın.', pointsCost: 500, category: 'exclusive', image: img('7651785') },
  { id: 'r5', title: 'Doğum Günü İkramiyesi', description: 'Doğum gününüzde herhangi bir içecek + tatlı.', pointsCost: 0, category: 'birthday', image: img('2198032') },
  { id: 'r6', title: 'Ücretsiz Boy Yükseltme', description: 'Herhangi bir içeceği Büyük boyuta yükseltin, bizden.', pointsCost: 80, category: 'coffee', image: img('2074130') },
  { id: 'r7', title: 'Çift Puan Günü', description: '24 saat boyunca tüm alışverişlerde 2x puan kazanın.', pointsCost: 250, category: 'discount', image: img('4109744') },
  { id: 'r8', title: 'Espresso Beans 250g', description: 'En kaliteli çekirdeklerimizden 250g eve götürün.', pointsCost: 600, category: 'exclusive', image: img('4109744') },
];

export const CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'Sabah Ritüeli', description: 'Bu hafta 4 gün, 09:00\'dan önce sipariş ver', progress: 3, target: 4, rewardPoints: 75, expires: '3 gün', type: 'weekly' },
  { id: 'c2', title: 'Lezzet Kaşifi', description: 'Farklı kategorilerden 3 içecek dene', progress: 2, target: 3, rewardPoints: 100, expires: '4 gün', type: 'weekly' },
  { id: 'c3', title: 'Sadık Seri', description: 'Üst üste 20 gün sipariş ver', progress: 14, target: 20, rewardPoints: 300, expires: '6 gün', type: 'streak' },
  { id: 'c4', title: 'Davet Krallığı', description: 'Sipariş veren 2 arkadaş davet et', progress: 1, target: 2, rewardPoints: 500, expires: '12 gün', type: 'monthly' },
  { id: 'c5', title: 'Matcha Ustası', description: 'Bu ay 5 matcha içeceği sipariş et', progress: 3, target: 5, rewardPoints: 120, expires: '18 gün', type: 'monthly' },
];

export const BADGES: Badge[] = [
  { id: 'b1', name: 'İlk Yudum', description: 'İlk siparişinizi tamamladınız', icon: 'Coffee', unlocked: true, date: 'Mar 2024' },
  { id: 'b2', name: 'Erken Kuş', description: '07:00\'dan önce 5 kez sipariş verdiniz', icon: 'Sunrise', unlocked: true, date: 'Nis 2024' },
  { id: 'b3', name: 'Seri Koruyucu', description: '7 günlük sipariş serisi', icon: 'Flame', unlocked: true, date: 'May 2024' },
  { id: 'b4', name: 'Kaşif', description: '10 farklı içecek denediniz', icon: 'Compass', unlocked: true, date: 'Haz 2024' },
  { id: 'b5', name: 'Uzman', description: 'Altın seviyeye ulaştınız', icon: 'Crown', unlocked: true, date: 'Tem 2024' },
  { id: 'b6', name: 'Sosyal İçici', description: 'Bir arkadaş davet ettiniz', icon: 'Users', unlocked: true, date: 'Ağu 2024' },
  { id: 'b7', name: 'Siyah Kart', description: 'Siyah seviyeye ulaş', icon: 'Diamond', unlocked: false },
  { id: 'b8', name: 'Yüzyıllık', description: '100 ömür boyu sipariş', icon: 'Award', unlocked: false },
  { id: 'b9', name: 'Kavurucu', description: 'Özel kavurumu ziyaret et', icon: 'FlaskConical', unlocked: false },
];

export const POINTS_HISTORY = [
  { id: 'ph1', title: 'Americano', points: 45, date: 'Bugün, 08:24', type: 'earn' },
  { id: 'ph2', title: 'Ücretsiz Boy Yükseltme kullanıldı', points: -80, date: 'Dün, 14:10', type: 'redeem' },
  { id: 'ph3', title: 'Croissant + Latte', points: 102, date: '2 gün önce', type: 'earn' },
  { id: 'ph4', title: 'Sabah Ritüeli görevi', points: 75, date: '3 gün önce', type: 'bonus' },
  { id: 'ph5', title: 'Cappuccino', points: 54, date: '4 gün önce', type: 'earn' },
  { id: 'ph6', title: 'Çift Puan Günü kullanıldı', points: -250, date: '5 gün önce', type: 'redeem' },
  { id: 'ph7', title: 'Rose Latte', points: 68, date: '6 gün önce', type: 'earn' },
];

// ─── Orders ─────────────────────────────────────────────
export const ORDERS: Order[] = [
  {
    id: 'EX-10472', date: 'Bugün, 08:24',
    items: [
      { name: 'Americano — Küçük, Yulaf Sütü', qty: 1, price: 220 },
      { name: 'Croissant', qty: 1, price: 75 },
    ],
    total: 295, status: 'preparing', store: 'Nişantaşı Mağaza', type: 'pickup', pointsEarned: 88,
  },
  {
    id: 'EX-10468', date: 'Dün, 15:40',
    items: [{ name: 'Cappuccino — Büyük', qty: 2, price: 230 }],
    total: 460, status: 'picked-up', store: 'Kadıköy Moda', type: 'pickup', pointsEarned: 138,
  },
  {
    id: 'EX-10451', date: '2 gün önce',
    items: [
      { name: 'Rose Latte — Küçük', qty: 1, price: 240 },
      { name: 'Egg Sandwich', qty: 1, price: 135 },
    ],
    total: 375, status: 'delivered', store: 'Nişantaşı Mağaza', type: 'delivery', pointsEarned: 112,
  },
  {
    id: 'EX-10433', date: '4 gün önce',
    items: [{ name: 'Cold Brew — Büyük', qty: 1, price: 230 }],
    total: 230, status: 'picked-up', store: 'Beşiktaş İskele', type: 'pickup', pointsEarned: 69,
  },
  {
    id: 'EX-10419', date: '5 gün önce',
    items: [{ name: 'Matcha Tea Latte — Büyük, Buzlu', qty: 2, price: 230 }],
    total: 460, status: 'picked-up', store: 'Nişantaşı Mağaza', type: 'table', pointsEarned: 138,
  },
];

// ─── Promotions ─────────────────────────────────────────────
export const PROMOTIONS: Promotion[] = [
  { id: 'pr1', title: 'Mutlu Saat', subtitle: 'Bir alana bir hediye — her gün 16:00 - 18:00', code: 'MUTLU2', discount: '1+1', image: img('302901'), expires: 'Bugün', type: 'happy-hour' },
  { id: 'pr2', title: 'Doğum Günü Ayı', subtitle: 'Ücretsiz içeceğiniz sizi bekliyor', code: 'DOGUMGUNU-X', discount: 'Ücretsiz', image: img('2198032'), expires: '21 gün', type: 'birthday' },
  { id: 'pr3', title: 'Nişantaşı\'na Hoş Geldin', subtitle: 'Buradaki ilk siparişinizde %15 indirim', code: 'NISAN15', discount: '%15 İND', image: img('683039'), expires: '6s kaldı', type: 'location' },
  { id: 'pr4', title: 'Arkadaşlarını Davet Et', subtitle: 'İkiniz de 200 puan kazanın', code: 'DAVET-X', discount: '200 puan', image: img('3194519'), expires: 'Sürekli', type: 'referral' },
  { id: 'pr5', title: 'Kahve Hediye Et', subtitle: 'Herhangi bir içeceği anında arkadaşına gönder', code: 'HEDIYE-X', discount: 'Hediye', image: img('1855214'), expires: 'Sürekli', type: 'gift' },
  { id: 'pr6', title: 'Cüzdan Yükleme Bonusu', subtitle: '₺400 yükle, ₺80 bonus kredi al', code: 'YUKLE400', discount: '+₺80', image: img('414645'), expires: '30 gün', type: 'wallet' },
];

// ─── Payment Methods ─────────────────────────────────────
export const PAYMENTS: PaymentMethod[] = [
  { id: 'pm1', type: 'apple-pay', label: 'Apple Pay', detail: 'Face ID', default: true },
  { id: 'pm2', type: 'card', label: 'Visa', detail: '•••• 4291', default: false },
  { id: 'pm3', type: 'wallet', label: 'Espresso X Cüzdan', detail: 'Mağaza kredisi', balance: 450, default: false },
  { id: 'pm4', type: 'gift-card', label: 'Hediye Kartı', detail: '•••• 8820', balance: 800, default: false },
  { id: 'pm5', type: 'google-pay', label: 'Google Pay', detail: 'Touch ID', default: false },
  { id: 'pm6', type: 'qr', label: 'QR Ödeme', detail: 'Tarayıp öde', default: false },
  { id: 'pm7', type: 'cash', label: 'Nakit', detail: 'Mağazada öde', default: false },
];

// ─── Customer ─────────────────────────────────────────────
export const CUSTOMER: Customer = {
  id: 'u1',
  name: 'Elif Yılmaz',
  email: 'elif.yilmaz@espressox.com',
  avatar: img('1239291', 200),
  tier: 'Altın',
  points: 4820,
  rewardWallet: 240,
  walletCredits: 450,
  lifetimePoints: 8420,
  streak: 14,
  joinedDate: 'Mart 2024',
  favoriteDrinks: ['Rose Latte', 'Americano', 'Matcha Tea Latte'],
  birthday: '21 Ağustos',
  memberNumber: 'EX-A-4820-9173',
};

// ─── Admin Data ─────────────────────────────────────────────
export const ADMIN_CUSTOMERS: AdminCustomer[] = [
  { id: 'ac1', name: 'Elif Yılmaz', email: 'elif.yilmaz@espressox.com', tier: 'Altın', orders: 47, spent: 6520, lastOrder: 'Bugün', status: 'vip', segment: 'En Değerli' },
  { id: 'ac2', name: 'Mehmet Demir', email: 'm.demir@gmail.com', tier: 'Siyah', orders: 132, spent: 28900, lastOrder: '2s önce', status: 'vip', segment: 'VIP' },
  { id: 'ac3', name: 'Ayşe Kaya', email: 'ayse.kaya@outlook.com', tier: 'Gümüş', orders: 23, spent: 2820, lastOrder: '1 gün önce', status: 'active', segment: 'Tekrar Eden' },
  { id: 'ac4', name: 'Can Öztürk', email: 'can.ozturk@proton.me', tier: 'Bronz', orders: 4, spent: 450, lastOrder: '18 gün önce', status: 'inactive', segment: 'Pasif' },
  { id: 'ac5', name: 'Zeynep Arslan', email: 'zeynep.arslan@gmail.com', tier: 'Altın', orders: 61, spent: 8400, lastOrder: 'Dün', status: 'active', segment: 'En Değerli' },
  { id: 'ac6', name: 'Emre Şahin', email: 'emre.sahin@yahoo.com', tier: 'Gümüş', orders: 19, spent: 2240, lastOrder: '3 gün önce', status: 'active', segment: 'Tekrar Eden' },
  { id: 'ac7', name: 'Defne Çelik', email: 'defne.celik@gmail.com', tier: 'VIP', orders: 210, spent: 51200, lastOrder: '1s önce', status: 'vip', segment: 'VIP' },
  { id: 'ac8', name: 'Burak Aydın', email: 'burak.aydin@icloud.com', tier: 'Bronz', orders: 7, spent: 810, lastOrder: '9 gün önce', status: 'inactive', segment: 'Bu Ay Doğum Günü' },
  { id: 'ac9', name: 'Selin Koç', email: 'selin.koc@gmail.com', tier: 'Altın', orders: 55, spent: 7800, lastOrder: 'Bugün', status: 'active', segment: 'En Değerli' },
  { id: 'ac10', name: 'Ali Aksoy', email: 'ali.aksoy@gmail.com', tier: 'Gümüş', orders: 31, spent: 3800, lastOrder: '5 gün önce', status: 'active', segment: 'Tekrar Eden' },
];

export const ADMIN_ORDERS: AdminOrder[] = [
  { id: 'EX-10472', customer: 'Elif Yılmaz', items: 2, total: 295, status: 'Hazırlanıyor', type: 'pickup', store: 'Nişantaşı', time: '08:24' },
  { id: 'EX-10471', customer: 'Mehmet Demir', items: 4, total: 510, status: 'Hazır', type: 'delivery', store: 'Bakırköy', time: '08:18' },
  { id: 'EX-10470', customer: 'Ayşe Kaya', items: 1, total: 230, status: 'Hazırlanıyor', type: 'pickup', store: 'Nişantaşı', time: '08:12' },
  { id: 'EX-10469', customer: 'Defne Çelik', items: 6, total: 765, status: 'Hazır', type: 'table', store: 'Kadıköy', time: '08:05' },
  { id: 'EX-10468', customer: 'Zeynep Arslan', items: 3, total: 285, status: 'Teslim Edildi', type: 'delivery', store: 'Beşiktaş', time: '07:58' },
  { id: 'EX-10467', customer: 'Selin Koç', items: 2, total: 180, status: 'Teslim Alındı', type: 'pickup', store: 'Nişantaşı', time: '07:51' },
  { id: 'EX-10466', customer: 'Ali Aksoy', items: 1, total: 230, status: 'Hazırlanıyor', type: 'scheduled', store: 'Bakırköy', time: '07:44' },
  { id: 'EX-10465', customer: 'Emre Şahin', items: 5, total: 455, status: 'Teslim Edildi', type: 'delivery', store: 'Karaköy', time: '07:30' },
];

export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Olivia Hart', role: 'Mağaza Müdürü', store: 'Nişantaşı Mağaza', status: 'active', avatar: img('762020', 100), shift: '06:00 – 14:00' },
  { id: 'e2', name: 'Noah Bennett', role: 'Baş Barista', store: 'Nişantaşı Mağaza', status: 'active', avatar: img('2182970', 100), shift: '06:00 – 14:00' },
  { id: 'e3', name: 'Emma Foster', role: 'Barista', store: 'Nişantaşı Mağaza', status: 'break', avatar: img('415829', 100), shift: '08:00 – 16:00' },
  { id: 'e4', name: 'Lucas Reyes', role: 'Barista', store: 'Kadıköy Moda', status: 'active', avatar: img('1681010', 100), shift: '07:00 – 15:00' },
  { id: 'e5', name: 'Mia Wallace', role: 'Vardiya Lideri', store: 'Kadıköy Moda', status: 'active', avatar: img('774909', 100), shift: '10:00 – 18:00' },
  { id: 'e6', name: 'Ethan Clarke', role: 'Barista', store: 'Beşiktaş İskele', status: 'off', avatar: img('1220726', 100), shift: '05:30 – 13:30' },
];

export const CAMPAIGNS: Campaign[] = [
  { id: 'cm1', name: 'Sonbahar Baharat Lansmanı', type: 'push', status: 'active', reach: 24800, conversion: 12.4, revenue: 18420, start: '1 Eki' },
  { id: 'cm2', name: 'VIP Tadım Daveti', type: 'email', status: 'active', reach: 1240, conversion: 38.2, revenue: 9240, start: '10 Eki' },
  { id: 'cm3', name: 'Doğum Günü Ayı — Ekim', type: 'birthday', status: 'active', reach: 1820, conversion: 24.1, revenue: 6120, start: '1 Eki' },
  { id: 'cm4', name: 'Mutlu Saat Hatırlatması', type: 'push', status: 'active', reach: 31000, conversion: 8.9, revenue: 9840, start: 'Günlük' },
  { id: 'cm5', name: 'Pasif Müşteri Geri Kazanım', type: 'sms', status: 'scheduled', reach: 4200, conversion: 0, revenue: 0, start: '22 Eki' },
  { id: 'cm6', name: 'Davet Bonusu Haftası', type: 'push', status: 'ended', reach: 19800, conversion: 6.2, revenue: 4200, start: '15 Eyl' },
];

export const REVENUE_DATA: ChartPoint[] = [
  { label: 'Pzt', value: 4200 }, { label: 'Sal', value: 5100 }, { label: 'Çar', value: 4800 },
  { label: 'Per', value: 6200 }, { label: 'Cum', value: 7800 }, { label: 'Cmt', value: 9400 },
  { label: 'Paz', value: 7200 },
];

export const ORDERS_DATA: ChartPoint[] = [
  { label: 'Pzt', value: 340 }, { label: 'Sal', value: 410 }, { label: 'Çar', value: 380 },
  { label: 'Per', value: 520 }, { label: 'Cum', value: 640 }, { label: 'Cmt', value: 780 },
  { label: 'Paz', value: 590 },
];

export const CATEGORY_PERF: ChartPoint[] = [
  { label: 'Espresso', value: 28 }, { label: 'Latte', value: 24 }, { label: 'Cold Brew', value: 18 },
  { label: 'Matcha', value: 12 }, { label: 'Unlu', value: 10 }, { label: 'Diğer', value: 8 },
];

export const STORE_PERF: ChartPoint[] = [
  { label: 'Nişan.', value: 18420 }, { label: 'Kadıköy', value: 14200 },
  { label: 'Beşik.', value: 10800 }, { label: 'Karaköy', value: 7600 },
  { label: 'Bakır.', value: 16400 },
];

export const AI_SUGGESTIONS = [
  { id: 'a1', text: 'Sabah rutininize göre, saat 08:15\'te bir Americano rutininize mükemmel uyuyor.', product: 'h01', confidence: 94 },
  { id: 'a2', text: 'Genellikle yulaf sütü ekliyorsunuz — Rose Latte\'niz yeniden siparişe hazır.', product: 'n03', confidence: 91 },
  { id: 'a3', text: 'Bugün 27°C. Bir Cold Brew ferahlatıcı olur.', product: 'c01', confidence: 87 },
  { id: 'a4', text: 'Eşleşme önerisi: Tiramisu ile Cappuccino.', product: 'p05', confidence: 82 },
];

export const AI_CHAT: { role: 'ai' | 'user'; text: string }[] = [
  { role: 'ai', text: 'Günaydın, Elif. Bu ay Rose Latte\'yi 9 kez sipariş ettiğini fark ettim — her zamankini hazırlayayım mı?' },
  { role: 'user', text: 'Evet, ama bugün buzlu olsun' },
  { role: 'ai', text: 'Elbette. Buzlu Rose Latte, Küçük, Yulaf Sütü — sepentine ₺240 olarak eklendi. 72 puan kazanacaksın.' },
  { role: 'user', text: 'Yanına bir şey eşleşir mi?' },
  { role: 'ai', text: 'Lezzet profilinize göre, Tiramisu harika eşleşir — kremsi yapısı gül aromasını tamamlar. Ekleyeyim mi?' },
];
