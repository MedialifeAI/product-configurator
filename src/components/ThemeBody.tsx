'use client';

import { useSiteConfig } from '@/context/SiteConfigProvider';

/** Applies theme accent to common Tailwind arbitrary overrides via inline where needed */
export function useThemeColor(name: keyof ReturnType<typeof useSiteConfig>['config']['theme']) {
  const { config } = useSiteConfig();
  return config.theme[name];
}
