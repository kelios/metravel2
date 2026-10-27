import type { ImmutableRequest } from 'expo-server';
import ScenarioScreen, { generateMetadata as scenarioMetadata } from './scenario.tsx';
import QuestDiscoveryLoaderBoundary from '@/components/quests/runtime/QuestDiscoveryLoaderBoundary.web';

export default function QuestScenarioRoute() {
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestDiscoveryLoaderBoundary><ScenarioScreen /></QuestDiscoveryLoaderBoundary> : <ScenarioScreen />;
}

export async function loader(request: ImmutableRequest | undefined) {
  const { loadQuestDiscovery } = await import('@/components/quests/runtime/questDiscoveryLoader');
  return loadQuestDiscovery(request, 'scenario');
}

export function generateMetadata() { return scenarioMetadata(); }
