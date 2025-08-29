import type { ExpoConfig, ConfigContext } from 'expo/config';
// Use a static import to the JSON to retain existing config, then override runtime bits via env
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appJson = require('./app.json');

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo || {};

  return {
    ...base,
    name: base.name || config.name,
    slug: base.slug || config.slug,
    version: base.version || config.version,
    orientation: base.orientation || config.orientation,
    icon: base.icon || config.icon,
    scheme: base.scheme || config.scheme,
    userInterfaceStyle: base.userInterfaceStyle || config.userInterfaceStyle,
    newArchEnabled: base.newArchEnabled ?? config.newArchEnabled,
    description: base.description || config.description,
    privacy: base.privacy || config.privacy,
    platforms: base.platforms || config.platforms,
    ios: base.ios || config.ios,
    android: base.android || config.android,
    web: base.web || config.web,
    plugins: base.plugins || config.plugins,
    experiments: base.experiments || config.experiments,
    extra: {
      ...(base.extra || {}),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || base.extra?.apiBaseUrl,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || base.extra?.supabaseUrl,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || base.extra?.supabaseAnonKey,
      eas: base.extra?.eas,
    },
  } as ExpoConfig;
};



