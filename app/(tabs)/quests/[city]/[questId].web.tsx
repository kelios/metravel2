import type { ImmutableRequest } from 'expo-server';
import LegacyQuestScreen from './[questId].tsx';
import QuestPublicLoaderScreen from '@/components/quests/runtime/QuestPublicLoaderScreen.web';
import type { QuestPublicStructuredData } from '@/components/quests/runtime/questPublicStructuredData';
import type { QuestLocaleRoute, QuestServingProjection } from '@/utils/questLocaleRouting';

type QuestDetailRouteProps = { route?: QuestLocaleRoute; publicProjection?: QuestServingProjection; publicStructuredData?: QuestPublicStructuredData };

export default function QuestDetailRoute({ route, publicProjection, publicStructuredData }: QuestDetailRouteProps = {}) {
  if (route || publicProjection) return <LegacyQuestScreen route={route} publicProjection={publicProjection} publicStructuredData={publicStructuredData} />;
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestPublicLoaderScreen>{(projection, state) => <LegacyQuestScreen publicProjection={projection ?? undefined}
      publicStructuredData={state.structuredData ?? undefined} />}</QuestPublicLoaderScreen>
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
