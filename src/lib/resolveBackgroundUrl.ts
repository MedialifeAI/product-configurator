import { resolveSource } from '@/lib/resolveModelUrl';
import type { ConfiguratorBackgroundOption } from '@/context/SceneSettings';

export function resolveBackgroundStyle(
  option: ConfiguratorBackgroundOption | undefined,
  fallbackColor: string,
): { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  if (!option || option.type === 'color') {
    return { backgroundColor: option?.color?.trim() || fallbackColor };
  }
  const url = resolveSource(option.image, '', { useOptimizedAssets: false });
  if (!url) return { backgroundColor: fallbackColor };
  return {
    backgroundColor: fallbackColor,
    backgroundImage: `url(${url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
