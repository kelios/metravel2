import { resolveMediaVariantUrl } from '@/utils/travelMediaVariants';
import offlineAssets from './offlineAssets';
import type {
  OfflineAssetDownloadOptions,
  OfflineAssetSource,
} from './offlineAssets.types';
import type { OfflineStoredAsset } from './types';

const IMAGE_URL_PATTERN = /https?:\/\/[^\s"'<>]+|\/(?:[^\s"'<>]+\.(?:jpe?g|png|webp|gif|avif))(?:\?[^\s"'<>]*)?/gi;
const MEDIA_KEY_PATTERN = /(?:image|photo|thumb|cover|poster|avatar|gallery)/i;

export function collectOfflineAssetSources(value: unknown, maxAssets = 12): OfflineAssetSource[] {
  const sources = new Map<string, string>();
  const pending: Array<{ value: unknown; key: string; depth: number }> = [{ value, key: '', depth: 0 }];
  const visited = new Set<object>();

  while (pending.length && sources.size < maxAssets) {
    const current = pending.shift();
    if (!current || current.depth > 16 || current.value == null) continue;

    if (typeof current.value === 'string') {
      const directMediaUrl = MEDIA_KEY_PATTERN.test(current.key) && /^(?:https?:\/\/|\/)/i.test(current.value.trim())
        ? [current.value.trim()]
        : [];
      const matches = [...directMediaUrl, ...(current.value.match(IMAGE_URL_PATTERN) ?? [])];
      for (const match of matches) {
        if (!MEDIA_KEY_PATTERN.test(current.key) && !/\.(?:jpe?g|png|webp|gif|avif)(?:\?|$)/i.test(match)) continue;
        const resolved = resolveMediaVariantUrl(match);
        if (resolved) sources.set(match, resolved);
        if (sources.size >= maxAssets) break;
      }
      continue;
    }

    if (typeof current.value !== 'object' || visited.has(current.value as object)) continue;
    visited.add(current.value as object);
    for (const [key, child] of Object.entries(current.value as Record<string, unknown>)) {
      pending.push({ value: child, key, depth: current.depth + 1 });
    }
  }

  return Array.from(sources, ([id, url]) => ({ id, url }));
}

export function rewriteOfflineAssetUrls<T>(snapshot: T, assets: OfflineStoredAsset[]): T {
  if (!assets.length) return snapshot;
  let serialized = JSON.stringify(snapshot);
  for (const asset of assets) {
    serialized = serialized.split(asset.id).join(asset.uri);
  }
  return JSON.parse(serialized) as T;
}

export async function downloadAndRewriteOfflineAssets<T>(
  packageKey: string,
  snapshot: T,
  maxAssets = 12,
  options: OfflineAssetDownloadOptions = {},
): Promise<{ snapshot: T; assets: OfflineStoredAsset[] }> {
  const sources = collectOfflineAssetSources(snapshot, maxAssets);
  return downloadAndRewriteOfflineAssetSources(packageKey, snapshot, sources, options);
}

export async function downloadAndRewriteOfflineAssetSources<T>(
  packageKey: string,
  snapshot: T,
  sources: OfflineAssetSource[],
  options: OfflineAssetDownloadOptions = {},
): Promise<{ snapshot: T; assets: OfflineStoredAsset[] }> {
  const assets = await offlineAssets.download(packageKey, sources, options);
  if (sources.length > 0 && assets.length !== sources.length) {
    await offlineAssets.remove(assets);
    throw new Error('OFFLINE_ASSET_SET_INCOMPLETE');
  }
  return { snapshot: rewriteOfflineAssetUrls(snapshot, assets), assets };
}
