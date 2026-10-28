import type { ImmutableRequest } from 'expo-server';
import { routeMetadata, shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata';
import { loadQuestPublicRoute } from './questRouteLoader';
import { questPublicAlternates } from './questPublicStructuredData';

export { buildQuestPublicStructuredData, questPublicAlternates } from './questPublicStructuredData';

export async function questPublicRouteMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const data = await loadQuestPublicRoute(request, params);
  if (!data) return shellRouteMetadata();
  return routeMetadata({ ...data.page.meta, ogType: 'website',
    robots: data.quality.indexable ? 'index, follow' : 'noindex, follow', alternates: questPublicAlternates(data) });
}
