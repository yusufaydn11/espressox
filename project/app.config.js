const fs = require('fs');
const path = require('path');

const googleServicesPath = path.join(__dirname, 'google-services.json');

/** Staging Supabase project ref — must never ship in production builds. */
const STAGING_PROJECT_REF = 'vnudnnigxohbyybxbtkz';

function hasProductionGoogleServices() {
  if (!fs.existsSync(googleServicesPath)) return false;
  const raw = fs.readFileSync(googleServicesPath, 'utf8');
  return !raw.includes('placeholder-not-for-production')
    && !raw.includes('REPLACE_WITH_FIREBASE_API_KEY');
}

function assertProductionBuildEnv() {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  if (profile !== 'production') return;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url) {
    throw new Error(
      '[Espresso X] Production build blocked: EXPO_PUBLIC_SUPABASE_URL is missing. '
      + 'Set it in EAS environment secrets (production), not staging .env.',
    );
  }
  if (!anonKey) {
    throw new Error(
      '[Espresso X] Production build blocked: EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. '
      + 'Set it in EAS environment secrets (production).',
    );
  }
  if (url.includes(STAGING_PROJECT_REF)) {
    throw new Error(
      '[Espresso X] Production build blocked: Supabase URL points to staging project. '
      + 'Configure production Supabase in EAS secrets.',
    );
  }
  for (const host of ['localhost', '127.0.0.1']) {
    if (url.includes(host)) {
      throw new Error(`[Espresso X] Production build blocked: Supabase URL contains ${host}.`);
    }
  }
  if (process.env.EXPO_PUBLIC_ENABLE_CARD_PAYMENTS === 'true') {
    throw new Error(
      '[Espresso X] Production build blocked: EXPO_PUBLIC_ENABLE_CARD_PAYMENTS must stay false until iyzico FAZ1.',
    );
  }

  const placeholderPatterns = ['example.com', 'your_url', 'placeholder', 'replace_with'];
  for (const key of ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_SUPPORT_URL', 'EXPO_PUBLIC_TERMS_URL']) {
    const val = process.env[key] ?? '';
    if (!val) continue;
    const lower = val.toLowerCase();
    if (placeholderPatterns.some(p => lower.includes(p)) || lower.includes('localhost')) {
      throw new Error(`[Espresso X] Production build blocked: ${key} contains placeholder or localhost URL.`);
    }
  }
}

assertProductionBuildEnv();

/** @param {import('expo/config').ConfigContext} param0 */
module.exports = ({ config }) => {
  const androidPermissions = [
    ...(config.android?.permissions ?? []),
    'POST_NOTIFICATIONS',
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  const infoPlist = { ...(config.ios?.infoPlist ?? {}) };
  delete infoPlist.NSUserTrackingUsageDescription;

  const android = {
    ...config.android,
    permissions: androidPermissions,
  };

  if (hasProductionGoogleServices()) {
    android.googleServicesFile = './google-services.json';
  } else {
    delete android.googleServicesFile;
  }

  const easProjectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId ?? '';

  return {
    ...config,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      infoPlist,
    },
    android,
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            minSdkVersion: 24,
          },
          ios: {
            deploymentTarget: '16.4',
          },
        },
      ],
    ],
    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: easProjectId,
      },
      /** Runtime hint for diagnostics — never contains secrets */
      appEnvironment: process.env.EAS_BUILD_PROFILE ?? 'local',
    },
  };
};
