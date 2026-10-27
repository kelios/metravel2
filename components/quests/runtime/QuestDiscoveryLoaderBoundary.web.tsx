import type { ReactNode } from 'react';
import { useLoaderData } from 'expo-router';
import { QuestDiscoveryContext } from './QuestDiscoveryContext';
import type { QuestDiscovery } from '@/utils/questDiscovery';

export default function QuestDiscoveryLoaderBoundary({ children }: { children: ReactNode }) {
  const loaded = useLoaderData() as QuestDiscovery | null;
  const data = loaded?.schema_version === 2 && loaded.state === 'available' && Array.isArray(loaded.quests)
    && ['home', 'catalog', 'scenario'].includes(loaded.view) ? loaded : null;
  return <QuestDiscoveryContext.Provider value={data}>{children}</QuestDiscoveryContext.Provider>;
}
