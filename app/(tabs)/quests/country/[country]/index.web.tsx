import type { ImmutableRequest } from 'expo-server';
import LegacyQuestCountry from './index.tsx';
import QuestPublicLoaderScreen from '@/components/quests/runtime/QuestPublicLoaderScreen.web';

export default function QuestCountryRoute() {
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestPublicLoaderScreen>{() => <LegacyQuestCountry />}</QuestPublicLoaderScreen> : <LegacyQuestCountry />;
}

export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadQuestPublicRoute } = await import('@/components/quests/runtime/questRouteLoader');
  return loadQuestPublicRoute(request, params);
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { questPublicRouteMetadata } = await import('@/components/quests/runtime/questPublicSeo');
  return questPublicRouteMetadata(request, params);
}
