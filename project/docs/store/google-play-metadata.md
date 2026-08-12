# Espresso X — Google Play Store Metadata (Draft)

## App Information

| Field | Value |
|-------|-------|
| **App name** | Espresso X |
| **Package name** | `com.espressox.app` |
| **Category** | Food & Drink |
| **Content rating** | Everyone / PEGI 3 equivalent |
| **Target audience** | General audience 13+ |
| **Ads** | No ads |

## Short description (80 chars)

Kahve siparişi, sadakat damgaları ve mağazadan teslim — Espresso X.

## Full description (TR)

Espresso X uygulaması ile menüden sipariş verin, sadakat damgaları toplayın ve ödüllerinizi kullanın.

- Menü ve sepet
- Nakit ödeme (mağazada ödeme) — kart ödemesi şu an kapalı
- Sadakat / damga kartı
- Sipariş geçmişi ve takip
- Hesap oluşturma ve **hesap silme** (Ayarlar)
- Gizlilik ve kullanım şartları uygulama içinde

## Data Safety (declarations)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email | Yes | No | Account |
| Name | Yes | No | Profile |
| Order history | Yes | No | App functionality |
| Location (optional) | When in use | No | Nearest store |
| Device push token | Optional | No | Notifications |

- Data encrypted in transit (HTTPS)
- User can request account deletion in-app
- No data sold to third parties

## Store listing requirements

- [ ] Privacy Policy URL (hosted HTTPS)
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots (see screenshot-plan.md)
- [ ] Play App Signing
- [ ] `google-services.json` for FCM (not committed)
- [ ] targetSdk 36 (configured in app.config.js)
