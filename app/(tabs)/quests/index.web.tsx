import type { ImmutableRequest } from 'expo-server';
import CatalogScreen, { generateMetadata as catalogMetadata } from './index.tsx';
import QuestDiscoveryLoaderBoundary from '@/components/quests/runtime/QuestDiscoveryLoaderBoundary.web';

export default function QuestCatalogRoute() {
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestDiscoveryLoaderBoundary><CatalogScreen /></QuestDiscoveryLoaderBoundary> : <CatalogScreen />;
}

export async function loader(request: ImmutableRequest | undefined) {
  const { loadQuestDiscovery } = await import('@/components/quests/runtime/questDiscoveryLoader');
  return loadQuestDiscovery(request, 'catalog');
}

export function generateMetadata() { return catalogMetadata(); }
