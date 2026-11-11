import type { ImmutableRequest } from 'expo-server';
import type { ComponentType } from 'react';
import LegacyScreenModule from './index.tsx';

// Metro по явному расширению берёт `index.tsx`, а TypeScript через `moduleSuffixes`
// (`.web` первым) разрешает тот же путь в ЭТОТ файл, поэтому тип default-экспорта
// здесь свой же и props экрана TS не видит — объявляем их явно (#2896).
const LegacyQuestCity = LegacyScreenModule as unknown as ComponentType<{
  notFound?: boolean;
  projectionMeta?: { title: string; description: string; locale: string } | null;
}>;
import QuestPublicLoaderScreen from '@/components/quests/runtime/QuestPublicLoaderScreen.web';

export default function QuestCityRoute() {
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestPublicLoaderScreen>{(_projection, state) => <LegacyQuestCity notFound={state.notFound} projectionMeta={state.meta} />}</QuestPublicLoaderScreen>
    : <LegacyQuestCity />;
}

export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadQuestPublicRoute } = await import('@/components/quests/runtime/questRouteLoader');
  return loadQuestPublicRoute(request, params);
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { questPublicRouteMetadata } = await import('@/components/quests/runtime/questPublicSeo');
  return questPublicRouteMetadata(request, params);
}
