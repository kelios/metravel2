import { useMemo, type ReactNode } from 'react';
import { useLoaderData } from 'expo-router';
import { QuestDiscoveryContext } from './QuestDiscoveryContext';
import { readQuestDiscoveryLoaderData } from '@/utils/questDiscoveryWire';

export default function QuestDiscoveryLoaderBoundary({ children }: { children: ReactNode }) {
  const loaded = useLoaderData() as unknown;
  // The loader sends compact rows (#3234); every reader of the context gets the full row shape.
  const data = useMemo(() => readQuestDiscoveryLoaderData(loaded), [loaded]);
  return <QuestDiscoveryContext.Provider value={data}>{children}</QuestDiscoveryContext.Provider>;
}
