import type { Article } from '@/types/types';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
import { resolveMediaVariantUrl } from '@/utils/travelMediaVariants';
import { offlineCatalog } from './offlineCatalog';
import { offlineOperations } from './offlineOperations';
import {
  collectOfflineAssetSources,
  downloadAndRewriteOfflineAssetSources,
} from './offlineAssetHelpers';
import type { OfflineAssetSource } from './offlineAssets.types';

const normalizeIdentifier = (value: string | number): string => String(value).trim();

export type ArticleOfflineSnapshot = Article & {
  schemaVersion: 1;
  safeHtml: string;
  sourceUpdatedAt?: string;
};

export function buildArticleOfflineSnapshot(article: Article): ArticleOfflineSnapshot {
  const source = article as Article & Record<string, unknown>;
  const safeHtml = sanitizeRichText(source.rich_text?.description?.safe_html ?? source.description);
  return {
    schemaVersion: 1,
    ...(source.id != null ? { id: source.id } : {}),
    ...(source.slug ? { slug: source.slug } : {}),
    ...(source.url ? { url: source.url } : {}),
    name: source.name,
    description: safeHtml,
    safeHtml,
    ...(source.rich_text ? { rich_text: source.rich_text } : {}),
    article_image_thumb_url: source.article_image_thumb_url,
    article_image_thumb_small_url: source.article_image_thumb_small_url,
    article_type: source.article_type,
    ...(source.rating != null ? { rating: source.rating } : {}),
    ...(source.rating_count != null ? { rating_count: source.rating_count } : {}),
    ...(source.userName != null ? { userName: source.userName } : {}),
    ...(source.user_name != null ? { user_name: source.user_name } : {}),
    ...(source.authorName != null ? { authorName: source.authorName } : {}),
    ...(source.author_name != null ? { author_name: source.author_name } : {}),
    ...(source.ownerName != null ? { ownerName: source.ownerName } : {}),
    ...(source.owner_name != null ? { owner_name: source.owner_name } : {}),
    ...(source.userId != null ? { userId: source.userId } : {}),
    ...(source.user_id != null ? { user_id: source.user_id } : {}),
    ...(source.authorId != null ? { authorId: source.authorId } : {}),
    ...(source.author_id != null ? { author_id: source.author_id } : {}),
    ...(source.ownerId != null ? { ownerId: source.ownerId } : {}),
    ...(source.owner_id != null ? { owner_id: source.owner_id } : {}),
    ...(source.userIds != null ? { userIds: source.userIds } : {}),
    ...(source.user_ids != null ? { user_ids: source.user_ids } : {}),
    ...(source.user ? {
      user: {
        ...(source.user.id != null ? { id: source.user.id } : {}),
        ...(source.user.name != null ? { name: source.user.name } : {}),
        ...(source.user.first_name != null ? { first_name: source.user.first_name } : {}),
        ...(source.user.last_name != null ? { last_name: source.user.last_name } : {}),
        ...(source.user.avatar != null ? { avatar: source.user.avatar } : {}),
      },
    } : {}),
    ...(typeof source.updated_at === 'string' ? { sourceUpdatedAt: source.updated_at } : {}),
  };
}

export const buildArticleAssetSources = (snapshot: ArticleOfflineSnapshot): OfflineAssetSource[] => {
  const inline = collectOfflineAssetSources({ description: snapshot.safeHtml }, Number.MAX_SAFE_INTEGER);
  const cover = [snapshot.article_image_thumb_url]
    .filter(Boolean)
    .map((id) => ({ id, url: resolveMediaVariantUrl(id) }))
    .filter((item): item is OfflineAssetSource => Boolean(item.url));
  const unique = new Map<string, OfflineAssetSource>();
  [...cover, ...inline].forEach((item) => unique.set(item.id, item));
  return Array.from(unique.values());
};

export async function saveArticleOffline(
  article: Article,
  options: {
    pinned?: boolean;
    includePhotos?: boolean;
    routeParam?: string | number;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    trackOperation?: boolean;
  } = {},
) {
  const sourceId = article.id ?? article.slug ?? options.routeParam;
  if (sourceId == null || !article.name) return null;
  const routeIdentifier = article.slug ?? options.routeParam ?? article.id;
  const key = `article:${normalizeIdentifier(sourceId)}`;
  const route = `/article/${encodeURIComponent(normalizeIdentifier(routeIdentifier ?? sourceId))}`;
  const publicSnapshot = buildArticleOfflineSnapshot(article);
  const persist = async (
    signal: AbortSignal | undefined,
    onProgress: ((done: number, total: number) => void) | undefined,
  ) => {
    onProgress?.(0, 1);
    const packaged = options.includePhotos
      ? await downloadAndRewriteOfflineAssetSources(
        key,
        publicSnapshot,
        buildArticleAssetSources(publicSnapshot),
        { signal, onProgress },
      )
      : { snapshot: publicSnapshot, assets: [] };

    try {
      if (signal?.aborted) {
        throw Object.assign(new Error('OFFLINE_OPERATION_ABORTED'), { name: 'AbortError' });
      }
      const manifest = await offlineCatalog.save({
        key,
        type: 'article',
        sourceId,
        authScope: 'public',
        route,
        title: article.name,
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
      type: 'article',
      sourceId,
      route,
      title: article.name,
    }, persist);
  }
  return persist(options.signal, options.onProgress);
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
  const snapshot = match ? await offlineCatalog.read<Article>(match.key) : null;
  if (!snapshot) return null;
  // Legacy public packages may contain the previous account's rating (#1799).
  const publicSnapshot = { ...snapshot };
  delete publicSnapshot.user_rating;
  return publicSnapshot;
}
