import QuestScenarioScreenImpl from '@/screens/tabs/QuestScenarioScreen'

// Static segment: Expo Router matches /quests/scenario here before the sibling
// [city] route, so the DIY landing is never treated as a city alias.
// Keep the route module tiny — the screen pulls the quest list dep itself.

export default function QuestScenarioScreen() {
  return <QuestScenarioScreenImpl />
}
