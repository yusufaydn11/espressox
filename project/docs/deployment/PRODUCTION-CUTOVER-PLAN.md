# Espresso X — Production Cutover Plan

> **Do not execute without explicit approval.** Replace `<PROD_*>` placeholders.

## Preconditions

- [ ] Production Supabase project created (separate from staging `vnudnnigxohbyybxbtkz`)
- [ ] Database backup policy confirmed
- [ ] EAS production environment secrets configured
- [ ] Firebase project + `google-services.json` (gitignored)
- [ ] Hosted HTTPS Privacy / Terms / Support URLs live
- [ ] Apple Developer + Google Play accounts ready

## Cutover sequence

| Step | Action | Approval required |
|------|--------|-------------------|
| 1 | Verify production Supabase URL + anon key in EAS secrets | Yes — credentials |
| 2 | Run `npm run validate:production-env -- --profile production` | No |
| 3 | Run `npm run validate:cutover-preflight` | No |
| 4 | `supabase link --project-ref <PROD_REF>` | Yes — prod project |
| 5 | Production migration preflight (review 70401–70800 SQL) | Yes |
| 6 | `supabase db push` — applies 70401 | Yes — prod DB |
| 7 | `supabase db push` — applies 70500 (iyzico infra, optional) | Yes |
| 8 | `supabase db push` — applies 70600 (account deletion) | Yes |
| 9 | `supabase db push` — applies 70700 (RLS hardening) | Yes |
| 10 | `supabase db push` — applies 70800 (QR restore) | Yes |
| 11 | Migration verification (`npm run test:migration-probe` against prod) | Yes — prod read |
| 12 | `supabase functions deploy delete-user --project-ref <PROD_REF>` | Yes — prod deploy |
| 13 | Edge Function smoke (account deletion dry-run on test user) | Yes |
| 14 | Production DB smoke (`validate:pre-production` against prod URL) | Yes |
| 15 | `eas build --platform android --profile production` | Yes — EAS build |
| 16 | Android QA on physical device | Manual |
| 17 | `eas build --platform ios --profile production` | Yes — EAS build |
| 18 | iOS QA on physical device | Manual |
| 19 | Store metadata + screenshots upload | Yes — store accounts |
| 20 | `eas submit` (internal track first) | Yes — store submit |

## Rollback notes

- **Migrations:** Restore from Supabase backup; do not run destructive rollback SQL without DBA review.
- **Edge Functions:** Redeploy previous version from git tag.
- **Mobile:** Previous EAS build channel; store rollback via App Store Connect / Play Console.

## Post-cutover verification

```bash
npm run validate:pre-production   # point .env to PROD temporarily, then revert
npm run smoke:staging             # keep staging for regression; use prod smoke script when added
npm run test:account-deletion -- --execute  # APPROVE_ACCOUNT_DELETE=1 on prod test user only
```

## Intentionally OFF until iyzico FAZ1

- `EXPO_PUBLIC_ENABLE_CARD_PAYMENTS=false`
- `retail-payment-initiate` / `retail-payment-webhook` Edge Function deploy
- iyzico sandbox/live credentials

Cash checkout remains the default payment method.
