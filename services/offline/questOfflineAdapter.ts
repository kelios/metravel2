import type { ApiQuestBundle } from '@/api/quests';
import { resolveMediaVariantUrl } from '@/utils/travelMediaVariants';
import { downloadAndRewriteOfflineAssetSources } from './offlineAssetHelpers';
import type { OfflineAssetSource } from './offlineAssets.types';
import { offlineCatalog } from './offlineCatalog';
import { offlineOperations } from './offlineOperations';

const questSteps = (value: ApiQuestBundle['steps']): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
};

const questIntro = (value: ApiQuestBundle['intro']): Record<string, unknown> | null => {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

export const buildQuestAssetSources = (bundle: ApiQuestBundle): OfflineAssetSource[] => {
  const urls = [
    bundle.cover_url,
    questIntro(bundle.intro)?.image_url,
    ...questSteps(bundle.steps).map((step) => step.image_url),
    bundle.finale?.poster_url,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return Array.from(new Set(urls))
    .map((id) => ({ id, url: resolveMediaVariantUrl(id) }))
    .filter((item): item is OfflineAssetSource => Boolean(item.url));
};

export async function saveQuestOffline(
  bundle: ApiQuestBundle,
  options: {
    pinned?: boolean;
    includePhotos?: boolean;
    cityId?: string | number;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    trackOperation?: boolean;
  } = {},
) {
  const questId = String(bundle.quest_id || '').trim();
  if (!questId || !bundle.title) return null;
  const key = `quest:${questId}`;
  const cityId = options.cityId ?? bundle.city?.id ?? 'city';
  const route = `/quests/${encodeURIComponent(String(cityId))}/${encodeURIComponent(questId)}`;
  const persist = async (
    signal: AbortSignal | undefined,
    onProgress: ((done: number, total: number) => void) | undefined,
  ) => {
    onProgress?.(0, 1);
    const packaged = options.includePhotos
      ? await downloadAndRewriteOfflineAssetSources(
        key,
        bundle,
        buildQuestAssetSources(bundle),
        { signal, onProgress },
      )
      : { snapshot: bundle, assets: [] };

    try {
      if (signal?.aborted) {
        throw Object.assign(new Error('OFFLINE_OPERATION_ABORTED'), { name: 'AbortError' });
      }
      const manifest = await offlineCatalog.save({
        key,
        type: 'quest',
        sourceId: questId,
        authScope: 'public',
        route,
        title: bundle.title,
        pinned: options.pinned,
        includePhotos: options.includePhotos,
        snapshot: packaged.snapshot,
        assets: packaged.assets,
      });
      onProgress?.(
        options.includePhotos ? Math.max(1, packaged.assets.length) : 1,
        options.includePhotos ? Math.max(1, packaged.assets.length) : 1,
      );
      return manifest;
    } catch (error) {
      if (packaged.assets.length) {
        const { default: offlineAssets } = await import('./offlineAssets');
        await offlineAssets.remove(packaged.assets);
      }
      throw error;
    }
  };

  if (options.pinned && options.trackOperation !== false && !options.signal) {
    return offlineOperations.run({
      key,
      type: 'quest',
      sourceId: questId,
      route,
      title: bundle.title,
    }, persist);
  }
  return persist(options.signal, options.onProgress);
}

export async function readQuestOffline(questId: string): Promise<ApiQuestBundle | null> {
  return offlineCatalog.read<ApiQuestBundle>(`quest:${String(questId).trim()}`);
}
