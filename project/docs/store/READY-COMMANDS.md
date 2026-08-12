# Espresso X — Production Ready Commands (DO NOT RUN WITHOUT APPROVAL)

Replace placeholders before execution. Never commit real secrets.

## 1. EAS production secrets

```bash
# Production Supabase (NOT staging ref vnudnnigxohbyybxbtkz)
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "<PROD_SUPABASE_URL>"
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<PROD_ANON_KEY>"
eas env:create --environment production --name EAS_PROJECT_ID --value "<EAS_PROJECT_UUID>"
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_CARD_PAYMENTS --value "false"
eas env:create --environment production --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://espressox.app/privacy"
eas env:create --environment production --name EXPO_PUBLIC_TERMS_URL --value "https://espressox.app/terms"
eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_URL --value "https://espressox.app/support"
```

Purpose: Wire production build to prod Supabase; keep card payments OFF.

## 2. Firebase (Android FCM)

```bash
# Place google-services.json in project root (gitignored)
# Download from Firebase Console → Project settings → Android app com.espressox.app
```

Purpose: Push notifications on Android.

## 3. Production database migrations

```bash
cd project
supabase link --project-ref <PROD_PROJECT_REF>
supabase db push
```

Purpose: Apply 70600–70800 (and prior) to production DB. **Destructive — backup first.**

## 4. Edge Functions (production)

```bash
cd project
supabase functions deploy delete-user --project-ref <PROD_PROJECT_REF>
# iyzico functions: deploy ONLY after merchant agreement
# supabase functions deploy retail-payment-initiate
# supabase functions deploy retail-payment-webhook
```

Purpose: Account deletion and optional payment webhooks.

## 5. EAS production build

```bash
cd project
eas build --platform all --profile production
```

Purpose: Signed native binaries for store submission.

## 6. Universal Links (server deploy)

Deploy to `https://espressox.app`:

- `/.well-known/apple-app-site-association` ← see `docs/deployment/universal-links/`
- `/.well-known/assetlinks.json` ← replace SHA256 fingerprint

Purpose: Password recovery / email verification deep links.

## 7. App Store submit

```bash
eas submit --platform ios --profile production
```

Update `eas.json` submit.ios placeholders: `appleId`, `ascAppId`, `appleTeamId`.

## 8. Google Play submit

```bash
eas submit --platform android --profile production
```

Requires `credentials/google-play-service-account.json` (gitignored).

## 9. Git (after review)

```bash
git add project/docs/
git commit -m "docs: store metadata and deployment templates"
git push origin feat/faz-0.1-rls-hardening
```

Purpose: Version control store/deployment docs only when approved.
