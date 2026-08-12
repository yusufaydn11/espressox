import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { Shield, FileText, ChevronRight, LifeBuoy } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_URL, supportMailtoUrl } from '@shared/constants/support';

type LegalTab = 'privacy' | 'terms';

export function LegalEntryButtons({ onOpen: _onOpen }: { onOpen?: (t: LegalTab) => void }) {
  const [tab, setTab] = useState<LegalTab | null>(null);

  return (
    <>
      <Sheet open={!!tab} onClose={() => setTab(null)} title={tab === 'privacy' ? 'Gizlilik Politikası' : 'Kullanım Şartları'}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {tab === 'privacy' && <PrivacyPolicy />}
          {tab === 'terms' && <TermsOfService />}
        </ScrollView>
      </Sheet>
      <Pressable
        onPress={() => setTab('privacy')}
        accessibilityRole="button"
        accessibilityLabel="Gizlilik Politikası"
        className={cn('flex-row items-center gap-3 px-4 py-3.5 border-b border-ink-100 active:bg-ink-50')}
      >
        <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
          <Shield size={17} color="#525258" />
        </View>
        <Text className="flex-1 text-sm font-medium text-ink-900">Gizlilik Politikası</Text>
        <ChevronRight size={16} color="#C4C4CC" />
      </Pressable>
      <Pressable
        onPress={() => setTab('terms')}
        accessibilityRole="button"
        accessibilityLabel="Kullanım Şartları"
        className="flex-row items-center gap-3 px-4 py-3.5 border-b border-ink-100 active:bg-ink-50"
      >
        <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
          <FileText size={17} color="#525258" />
        </View>
        <Text className="flex-1 text-sm font-medium text-ink-900">Kullanım Şartları</Text>
        <ChevronRight size={16} color="#C4C4CC" />
      </Pressable>
      <SupportEntryButton />
    </>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-base font-semibold text-ink-900 mb-1.5">{title}</Text>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-sm text-ink-400">•</Text>
      <Text className="text-sm text-ink-500 flex-1">{children}</Text>
    </View>
  );
}

function ExternalPolicyLinks() {
  const privacyUrl = PRIVACY_POLICY_URL;
  const termsUrl = TERMS_URL;
  const supportUrl = SUPPORT_URL;

  if (!privacyUrl && !termsUrl && !supportUrl) return null;

  return (
    <View className="mb-4 gap-2">
      {privacyUrl ? (
        <Pressable onPress={() => void Linking.openURL(privacyUrl)}>
          <Text className="text-xs text-ex-red font-medium">Gizlilik politikasını web'de görüntüle</Text>
        </Pressable>
      ) : null}
      {termsUrl ? (
        <Pressable onPress={() => void Linking.openURL(termsUrl)}>
          <Text className="text-xs text-ex-red font-medium">Kullanım şartlarını web'de görüntüle</Text>
        </Pressable>
      ) : null}
      {supportUrl ? (
        <Pressable onPress={() => void Linking.openURL(supportUrl)}>
          <Text className="text-xs text-ex-red font-medium">Destek sayfası</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SupportEntryButton() {
  const openSupport = () => {
    if (SUPPORT_URL) {
      void Linking.openURL(SUPPORT_URL);
      return;
    }
    void Linking.openURL(supportMailtoUrl());
  };

  return (
    <Pressable
      onPress={openSupport}
      accessibilityRole="button"
      accessibilityLabel="Destek"
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-50"
    >
      <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
        <LifeBuoy size={17} color="#525258" />
      </View>
      <Text className="flex-1 text-sm font-medium text-ink-900">Destek</Text>
      <ChevronRight size={16} color="#C4C4CC" />
    </Pressable>
  );
}

function PrivacyPolicy() {
  return (
    <View>
      <ExternalPolicyLinks />
      <Text className="text-xs text-ink-400 mb-4">Son güncelleme: 24 Temmuz 2026</Text>

      <LegalSection title="1. Giriş">
        <Text className="text-sm text-ink-500 leading-relaxed">Espresso X ("uygulama", "biz"), gizliliğinize saygı duyar. Bu Gizlilik Politikası, uygulamamızı kullanırken hangi kişisel verileri topladığımızı, nasıl kullandığımızı, koruduğumuzu ve hangi haklara sahip olduğunuzu açıklar.</Text>
        <Text className="text-sm text-ink-500 leading-relaxed">Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve Avrupa Birliği Genel Veri Koruma Yönetmeliği (GDPR) ile uyumludur.</Text>
      </LegalSection>

      <LegalSection title="2. Toplanan Veriler">
        <Text className="text-sm text-ink-500 leading-relaxed">Hesabınızı oluşturduğunuzda şu verileri toplarız:</Text>
        <Bullet>Ad soyad, e-posta adresi</Bullet>
        <Bullet>Sipariş geçmişi ve ödeme tercihleri</Bullet>
        <Bullet>Sadakat puanları ve ödül durumu</Bullet>
        <Bullet>Cihaz bildirim tercihleri (yalnızca izin verdiğinizde)</Bullet>
        <Text className="text-sm text-ink-500 leading-relaxed">Ödeme kart bilgileri bizde saklanmaz — ödemeler güvenli ödeme servis sağlayıcıları aracılığıyla işlenir.</Text>
      </LegalSection>

      <LegalSection title="3. Verilerin Kullanımı">
        <Text className="text-sm text-ink-500 leading-relaxed">Verilerinizi şu amaçlarla kullanırız:</Text>
        <Bullet>Siparişlerinizi hazırlamak ve teslim etmek</Bullet>
        <Bullet>Sadakat programını yönetmek</Bullet>
        <Bullet>İzin verdiğiniz takdirde kampanya bildirimleri göndermek</Bullet>
        <Bullet>Uygulama performansını iyileştirmek (anonim analiz)</Bullet>
        <Text className="text-sm text-ink-500 leading-relaxed">Verilerinizi hiçbir üçüncü tarafla pazarlama amacıyla paylaşmayız.</Text>
      </LegalSection>

      <LegalSection title="4. Veri Saklama ve Güvenlik">
        <Text className="text-sm text-ink-500 leading-relaxed">Verileriniz, son aktif kullanımınızdan itibaren hesabınızı silene kadar saklanır. Veriler aktarım sırasında ve beklerken endüstri standardı şifreleme ile korunur.</Text>
        <Text className="text-sm text-ink-500 leading-relaxed">Kimlik doğrulaması olmayan kullanıcılar hiçbir özel veriye erişemez. Tüm veri erişimi güvenlik kurallarıyla sınırlandırılmıştır.</Text>
      </LegalSection>

      <LegalSection title="5. Haklarınız (KVKK Madde 11 / GDPR Madde 15)">
        <Text className="text-sm text-ink-500 leading-relaxed">Aşağıdaki haklara sahipsiniz:</Text>
        <Bullet>Kişisel verilerinize erişim</Bullet>
        <Bullet>Yanlış verilerin düzeltilmesi</Bullet>
        <Bullet>Verilerin silinmesi ("unutulma hakkı")</Bullet>
        <Bullet>Veri işlemenin kısıtlanması</Bullet>
        <Bullet>Veri taşınabilirliği</Bullet>
        <Bullet>İşleme itiraz etme</Bullet>
        <Text className="text-sm text-ink-500 leading-relaxed">Bu haklardan herhangi birini kullanmak için hesap ayarlarından "Hesabımı Sil" seçeneğini kullanabilir veya bizimle iletişime geçebilirsiniz.</Text>
      </LegalSection>

      <LegalSection title="6. Çocuk Gizliliği">
        <Text className="text-sm text-ink-500 leading-relaxed">Uygulamamız 16 yaşından küçük çocuklara yönelik değildir. Bilerek çocuk verisi toplamıyoruz.</Text>
      </LegalSection>

      <LegalSection title="7. İletişim">
        <Text className="text-sm text-ink-500 leading-relaxed">Gizlilik konusunda sorularınız için: gizlilik@espressox.com</Text>
      </LegalSection>
    </View>
  );
}

function TermsOfService() {
  return (
    <View>
      <ExternalPolicyLinks />
      <Text className="text-xs text-ink-400 mb-4">Son güncelleme: 24 Temmuz 2026</Text>

      <LegalSection title="1. Kabul">
        <Text className="text-sm text-ink-500 leading-relaxed">Bu Kullanım Şartları, Espresso X uygulamasını kullanımınızı düzenler. Uygulamayı kullanarak bu şartları kabul etmiş olursunuz.</Text>
      </LegalSection>

      <LegalSection title="2. Hizmetler">
        <Text className="text-sm text-ink-500 leading-relaxed">Uygulama, kahve ve yiyecek siparişi, sadakat programı, mağaza bulma ve ödül yönetimi hizmetleri sunar. Hizmetlerin sürekliliğini garanti etmiyoruz; planlı bakım çalışmaları olabilir.</Text>
      </LegalSection>

      <LegalSection title="3. Hesap Sorumluluğu">
        <Text className="text-sm text-ink-500 leading-relaxed">Hesabınızın güvenliğinden siz sorumlusunuz. Hesap bilgilerinizi başkalarıyla paylaşmayın. Hesabınızda yapılan tüm işlemlerin sizin sorumluluğunuzda kabul edilir.</Text>
      </LegalSection>

      <LegalSection title="4. Siparişler ve Ödeme">
        <Text className="text-sm text-ink-500 leading-relaxed">Sipariş verdiğinizde, seçtiğiniz ürünlerin fiyatını kabul etmiş olursunuz. Ödemeler güvenli ödeme servis sağlayıcıları aracılığıyla işlenir. Yanlış fiyatlandırma veya teknik hata durumunda siparişi iptal etme hakkımızı saklı tutarız.</Text>
      </LegalSection>

      <LegalSection title="5. Sadakat Programı">
        <Text className="text-sm text-ink-500 leading-relaxed">Puanlar ve ödüller gerçek para değeri taşımaz ve transfer edilemez. Hileli puan kazanımı tespit edilirse puanlar iptal edilebilir. Sadakat programı kurallarını değiştirme hakkımızı saklı tutarız.</Text>
      </LegalSection>

      <LegalSection title="6. Fikri Mülkiyet">
        <Text className="text-sm text-ink-500 leading-relaxed">Uygulamadaki tüm görseller, logolar ve içerik Espresso X'e aittir. İzinsiz kullanımı yasaktır.</Text>
      </LegalSection>

      <LegalSection title="7. Sorumluluğun Sınırlandırılması">
        <Text className="text-sm text-ink-500 leading-relaxed">Uygulama "olduğu gibi" sunulur. Dolaylı zararlar için sorumluluğumuz yasal sınırlar içinde tutulur.</Text>
      </LegalSection>

      <LegalSection title="8. Hesap Silme">
        <Text className="text-sm text-ink-500 leading-relaxed">Hesabınızı istediğiniz zaman hesap ayarlarından silebilirsiniz. Hesap silindiğinde tüm kişisel verileriniz 30 gün içinde kalıcı olarak silinir.</Text>
      </LegalSection>

      <LegalSection title="9. Şartların Değişimi">
        <Text className="text-sm text-ink-500 leading-relaxed">Bu şartları zaman zaman güncelleyebiliriz. Önemli değişiklikler uygulamada bildirim yoluyla duyurulur.</Text>
      </LegalSection>

      <LegalSection title="10. İletişim">
        <Text className="text-sm text-ink-500 leading-relaxed">Sorularınız için: destek@espressox.com</Text>
      </LegalSection>
    </View>
  );
}
