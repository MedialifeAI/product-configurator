import type { DragonId, MetalId, ModelSource, SiteConfig } from '@/lib/siteConfigTypes';

export function getModelSourceByKey(config: SiteConfig, key: string): ModelSource | null {
  const { catalog } = config;
  if (key === 'hero-watch') return catalog.heroWatch;
  if (key === 'ar-watch') return catalog.arWatch;
  if (key === 'config-assembly') {
    if (config.scene.configModelUrl) {
      return { type: 'url', url: config.scene.configModelUrl };
    }
    return null;
  }
  if (key === 'parts/dial') return catalog.staticParts.dial ?? null;
  if (key === 'parts/globe') return catalog.staticParts.globe ?? null;

  const globeMatch = key.match(/^parts\/globe\/(rose_gold|white_gold|yellow_gold)$/);
  if (globeMatch) {
    return catalog.globeParts[globeMatch[1] as MetalId] ?? null;
  }
  if (key === 'parts/hand') return catalog.staticParts.hand ?? null;
  if (key === 'parts/strap') return catalog.staticParts.strap ?? null;

  const metalMatch = key.match(/^metal\/([\w]+)\/(case-body|case|movement)$/);
  if (metalMatch) {
    const metal = metalMatch[1] as MetalId;
    const part = metalMatch[2] === 'case-body' ? 'caseBody' : metalMatch[2];
    return catalog.metalParts[metal]?.[part as 'caseBody' | 'case' | 'movement'] ?? null;
  }

  const dragonMatch = key.match(/^dragon\/(v[1-4])$/);
  if (dragonMatch) {
    const d = catalog.dragons.find(x => x.id === dragonMatch[1] as DragonId);
    return d?.model ?? null;
  }

  return null;
}

export function setModelSourceByKey(
  config: SiteConfig,
  key: string,
  source: ModelSource | null,
): SiteConfig {
  const next = structuredClone(config);

  if (key === 'hero-watch') {
    next.catalog.heroWatch = source ?? next.catalog.heroWatch;
    return next;
  }
  if (key === 'ar-watch') {
    next.catalog.arWatch = source ?? next.catalog.arWatch;
    return next;
  }
  if (key === 'config-assembly') {
    if (!source || source.type === 'builtin') {
      next.scene.configModelUrl = null;
    } else if (source.type === 'url') {
      next.scene.configModelUrl = source.url;
    } else if (source.type === 'blob') {
      next.scene.configModelUrl = `/api/models/${source.key}`;
    }
    return next;
  }

  const globeMatch = key.match(/^parts\/globe\/(rose_gold|white_gold|yellow_gold)$/);
  if (globeMatch) {
    const metal = globeMatch[1] as MetalId;
    if (source) next.catalog.globeParts[metal] = source;
    else delete next.catalog.globeParts[metal];
    return next;
  }

  if (key.startsWith('parts/')) {
    const part = key.replace('parts/', '') as keyof typeof next.catalog.staticParts;
    if (source) next.catalog.staticParts[part] = source;
    else delete next.catalog.staticParts[part];
    return next;
  }

  const metalMatch = key.match(/^metal\/([\w]+)\/(case-body|case|movement)$/);
  if (metalMatch) {
    const metal = metalMatch[1] as MetalId;
    const partKey = metalMatch[2] === 'case-body' ? 'caseBody' : metalMatch[2];
    next.catalog.metalParts[metal] = next.catalog.metalParts[metal] ?? {};
    if (source) {
      next.catalog.metalParts[metal][partKey as 'caseBody' | 'case' | 'movement'] = source;
    }
    return next;
  }

  const dragonMatch = key.match(/^dragon\/(v[1-4])$/);
  if (dragonMatch) {
    const idx = next.catalog.dragons.findIndex(x => x.id === dragonMatch[1]);
    if (idx >= 0) {
      next.catalog.dragons[idx] = {
        ...next.catalog.dragons[idx]!,
        model: source ?? undefined,
      };
    }
    return next;
  }

  return next;
}

export function defaultBuiltinForKey(key: string, config: SiteConfig): ModelSource {
  const existing = getModelSourceByKey(config, key);
  if (existing?.type === 'builtin') return existing;

  if (key === 'hero-watch') return config.catalog.heroWatch;
  if (key === 'ar-watch') return config.catalog.arWatch;

  const dragonMatch = key.match(/^dragon\/(v[1-4])$/);
  if (dragonMatch) {
    const d = config.catalog.dragons.find(x => x.id === dragonMatch[1]);
    return { type: 'builtin', path: d!.builtinPath };
  }

  const metalMatch = key.match(/^metal\/([\w]+)\/(case-body|case|movement)$/);
  if (metalMatch) {
    const metal = metalMatch[1] as MetalId;
    const part = metalMatch[2] === 'case-body' ? 'caseBody' : metalMatch[2];
    const p = config.catalog.metalParts[metal]?.[part as 'caseBody' | 'case' | 'movement'];
    if (p?.type === 'builtin') return p;
    const path =
      part === 'caseBody'
        ? `/models/case_body/case_body_${metal}.glb`
        : part === 'case'
          ? `/models/case/case_${metal}.glb`
          : `/models/movement/movement_${metal}.glb`;
    return { type: 'builtin', path };
  }

  const globeMatch = key.match(/^parts\/globe\/(rose_gold|white_gold|yellow_gold)$/);
  if (globeMatch) {
    return { type: 'builtin', path: `/models/parts/globe_${globeMatch[1]}.glb` };
  }

  const part = key.replace('parts/', '');
  return { type: 'builtin', path: `/models/parts/${part}.glb` };
}
