import QuestScenarioScreenImpl from '@/screens/tabs/QuestScenarioScreen'

// Static segment, same shape as the sibling quests/map.tsx: Expo Router matches
// /quests/scenario here before [city], so the DIY landing is never taken for a
// city alias. Keep the route module tiny — the screen pulls its own deps.

export default function QuestScenarioRoute() {
  return <QuestScenarioScreenImpl />
}
