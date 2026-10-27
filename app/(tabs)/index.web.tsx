import type { ImmutableRequest } from 'expo-server';
import HomeScreen, { generateMetadata as homeMetadata } from './index.tsx';
import QuestDiscoveryLoaderBoundary from '@/components/quests/runtime/QuestDiscoveryLoaderBoundary.web';

export default function HomeRoute() {
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestDiscoveryLoaderBoundary><HomeScreen /></QuestDiscoveryLoaderBoundary> : <HomeScreen />;
}

export async function loader(request: ImmutableRequest | undefined) {
  const { loadQuestDiscovery } = await import('@/components/quests/runtime/questDiscoveryLoader');
  return loadQuestDiscovery(request, 'home');
}

export function generateMetadata() { return homeMetadata(); }
