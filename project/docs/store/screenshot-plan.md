# Espresso X — Store Screenshot Plan

Automated screenshot generation is not configured in CI. Capture manually on real devices or simulators.

## Required screens (content)

1. **Home / Menu** — product categories visible
2. **Product detail** — price, add to cart
3. **Cart** — items, total
4. **Checkout** — cash payment selected, store pickup
5. **Order tracking** — active order status
6. **Loyalty / Rewards** — stamp progress, QR code
7. **Profile** — account settings entry
8. **Settings / Legal** — Privacy, Terms, Support, **Delete Account**
9. **Support / Privacy** — in-app legal text

## Apple App Store sizes

| Device | Size (px) | Count |
|--------|-----------|-------|
| iPhone 6.7" | 1290 × 2796 | 3–10 |
| iPhone 6.5" | 1284 × 2778 | optional |
| iPad Pro 12.9" | 2048 × 2732 | if supporting tablet |

## Google Play sizes

| Type | Size (px) | Count |
|------|-----------|-------|
| Phone | 1080 × 1920 min | 2–8 |
| 7" tablet | 1200 × 1920 | optional |
| Feature graphic | 1024 × 500 | 1 |

## Capture commands (local)

```bash
# Start app
npm run ios   # or npm run android

# Use simulator/device screenshot tools:
# iOS Simulator: Cmd+S
# Android: adb exec-out screencap -p > screenshot.png
```

## Reviewer-sensitive screens

Include one screenshot showing **Ayarlar → Hesabı Sil** path (Settings with delete account visible) for Apple account deletion compliance.
