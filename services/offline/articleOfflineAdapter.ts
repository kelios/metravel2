import type { Article } from '@/types/types';
import { offlineCatalog } from './offlineCatalog';
import { downloadAndRewriteOfflineAssets } from './offlineAssetHelpers';

const normalizeIdentifier = (value: string | number): string => String(value).trim();

export async function saveArticleOffline(
  article: Article,
  options: { pinned?: boolean; includePhotos?: boolean; routeParam?: string | number } = {},
) {
  const sourceId = article.id ?? article.slug ?? options.routeParam;
  if (sourceId == null || !article.name) return null;
  const routeIdentifier = article.slug ?? options.routeParam ?? article.id;
  const key = `article:${normalizeIdentifier(sourceId)}`;
  const packaged = options.includePhotos
    ? await downloadAndRewriteOfflineAssets(key, article, 12)
    : { snapshot: article, assets: [] };

  try {
    return await offlineCatalog.save({
      key,
      type: 'article',
      sourceId,
      authScope: 'public',
      route: `/article/${encodeURIComponent(normalizeIdentifier(routeIdentifier ?? sourceId))}`,
      title: article.name,
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

export async function readArticleOffline(
  identifier: string | number,
): Promise<Article | null> {
  const normalized = normalizeIdentifier(identifier);
  const items = await offlineCatalog.list();
  const match = items.find((item) => {
    if (item.type !== 'article' || item.status !== 'ready') return false;
    if (item.sourceId === normalized || item.key === `article:${normalized}`) return true;
    const routeIdentifier = decodeURIComponent(item.route.split('/').filter(Boolean).pop() ?? '');
    return routeIdentifier === normalized;
  });
  return match ? offlineCatalog.read<Article>(match.key) : null;
}
