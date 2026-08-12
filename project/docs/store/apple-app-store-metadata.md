# Espresso X — Apple App Store Metadata (Draft)

> Legal review required before submission. Replace placeholder URLs with hosted HTTPS pages.

## App Information

| Field | Value |
|-------|-------|
| **App Name** | Espresso X |
| **Subtitle** | Kahve siparişi & sadakat |
| **Bundle ID** | `com.espressox.app` |
| **SKU** | `espresso-x-ios-001` |
| **Primary Category** | Food & Drink |
| **Secondary Category** | Lifestyle |
| **Age Rating** | 4+ (no restricted content) |
| **Copyright** | © 2026 Espresso X |

## Description (TR)

Espresso X ile en yakın Espresso X mağazasından kahve ve atıştırmalık sipariş edin, sadakat damgaları kazanın ve ödüllerinizi kullanın.

**Özellikler:**
- Menüden hızlı sipariş ve mağazadan teslim alma
- Nakit ödeme ile güvenli sipariş (kart ödemesi yakında)
- Damga kartı ve sadakat ödülleri
- Sipariş takibi
- Hesap oluşturma, profil yönetimi ve **hesap silme** (Ayarlar içinde)
- Gizlilik Politikası ve Kullanım Şartları uygulama içinde

## Keywords

`espresso,kahve,sipariş,sadakat,damga,qr,mağaza,pickup`

## Privacy & Data

- **Account deletion:** In-app → Profil → Ayarlar → Hesabı Sil
- **Privacy Policy URL:** `EXPO_PUBLIC_PRIVACY_POLICY_URL` (hosted HTTPS — required for store)
- **Support URL:** `EXPO_PUBLIC_SUPPORT_URL` or mailto destek@espressox.com
- **Tracking (ATT):** Not used — no `NSUserTrackingUsageDescription`
- **Sign in with Apple:** Configured (`usesAppleSignIn: true`)

## App Review Notes

```
Demo account (staging):
  Email: [PROVIDE_REVIEWER_EMAIL]
  Password: [PROVIDE_REVIEWER_PASSWORD]

Notes for reviewer:
- Card payment is intentionally disabled; checkout uses cash (payment at store).
- QR scanning for loyalty is staff-side in Admin Scanner; customer shows QR in Rewards.
- Account deletion: Profile → Settings → Delete Account (permanent).
- Push notifications require physical device + Firebase (optional for review).
- Associated domain: espressox.app (Universal Links — server files must be deployed).
```

## Required Before Submit

- [ ] Hosted Privacy Policy HTTPS URL
- [ ] App Store Connect screenshots (see screenshot-plan.md)
- [ ] Apple Developer signing & provisioning
- [ ] Production Supabase in EAS secrets (not staging)
- [ ] EAS production build
