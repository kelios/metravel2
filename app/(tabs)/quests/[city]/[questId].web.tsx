import type { ImmutableRequest } from 'expo-server';
import LegacyQuestScreen from './[questId].tsx';
import QuestPublicLoaderScreen from '@/components/quests/runtime/QuestPublicLoaderScreen.web';
import type { QuestLocaleRoute, QuestServingProjection } from '@/utils/questLocaleRouting';

export default function QuestDetailRoute({ route, publicProjection }: { route?: QuestLocaleRoute; publicProjection?: QuestServingProjection } = {}) {
  if (route || publicProjection) return <LegacyQuestScreen route={route} publicProjection={publicProjection} />;
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestPublicLoaderScreen>{(projection) => <LegacyQuestScreen publicProjection={projection ?? undefined} />}</QuestPublicLoaderScreen>
    : <LegacyQuestScreen />;
}

export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadQuestPublicRoute } = await import('@/components/quests/runtime/questRouteLoader');
  return loadQuestPublicRoute(request, params);
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { questPublicRouteMetadata } = await import('@/components/quests/runtime/questPublicSeo');
  return questPublicRouteMetadata(request, params);
}
