import { fetchArticle, fetchArticleBySlug, extractArticleIdFromParam } from '@/api/articles';
import { queryKeys } from '@/api/queryKeys';
import { translate as i18nT } from '@/i18n';
import type { Article } from '@/types/types';

/** The detail and its breadcrumb share both the cache identity and failure policy. */
export const articleQueryOptions = (param: string | null) => {
  const id = extractArticleIdFromParam(param);
  return {
    // A slug ending in a number may resolve to a different article through
    // the legacy fallback; it must not poison that numeric route's cache.
    queryKey: queryKeys.article(id !== null && param === String(id) ? id : param ?? undefined),
    enabled: Boolean(param),
    staleTime: 600_000,
    gcTime: 600_000,
    retry: false as const,
    // The transport owns offline fallback; allow it to read the saved article.
    networkMode: 'always' as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (!param) return null;
      let article: Article;
      if (!id) {
        article = await fetchArticleBySlug(param, { signal, throwOnError: true });
      } else {
        try {
          article = await fetchArticle(id, { signal, throwOnError: true });
        } catch (error) {
          if (signal.aborted || param === String(id)) throw error;
          article = await fetchArticleBySlug(param, { signal, throwOnError: true });
        }
      }
      if (!article?.id) throw new Error(i18nT('shared:app.tabs.article.id.statya_ne_naydena_697a610d'));
      return article;
    },
  };
};
