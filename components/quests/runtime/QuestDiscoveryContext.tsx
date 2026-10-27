import { createContext, useContext } from 'react';
import type { QuestDiscovery } from '@/utils/questDiscovery';

export const QuestDiscoveryContext = createContext<QuestDiscovery | null>(null);
export const useQuestDiscovery = () => useContext(QuestDiscoveryContext);
