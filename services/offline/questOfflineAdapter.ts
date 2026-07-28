import type { ApiQuestBundle } from '@/api/quests';
import { downloadAndRewriteOfflineAssets } from './offlineAssetHelpers';
import { offlineCatalog } from './offlineCatalog';

export async function saveQuestOffline(
  bundle: ApiQuestBundle,
  options: { pinned?: boolean; includePhotos?: boolean; cityId?: string | number } = {},
) {
  const questId = String(bundle.quest_id || '').trim();
  if (!questId || !bundle.title) return null;
  const key = `quest:${questId}`;
  const packaged = options.includePhotos
    ? await downloadAndRewriteOfflineAssets(key, bundle, 32)
    : { snapshot: bundle, assets: [] };
  const cityId = options.cityId ?? bundle.city?.id ?? 'city';

  try {
    return await offlineCatalog.save({
      key,
      type: 'quest',
      sourceId: questId,
      authScope: 'public',
      route: `/quests/${encodeURIComponent(String(cityId))}/${encodeURIComponent(questId)}`,
      title: bundle.title,
      pinned: options.pinned,
      includePhotos: options.includePhotos,
      snapshot: packaged.snapshot,
      assets: packaged.assets,
    });
  } catch (error) {
    if (packaged.assets.length) {
      const { default: offlineAssets } = await import('./offlineAssets');
      await offlineAssets.remove(packaged.assets);
    }
    throw error;
  }
}

export async function readQuestOffline(questId: string): Promise<ApiQuestBundle | null> {
  return offlineCatalog.read<ApiQuestBundle>(`quest:${String(questId).trim()}`);
}
