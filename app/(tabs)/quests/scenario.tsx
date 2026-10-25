import QuestScenarioScreenImpl from '@/screens/tabs/QuestScenarioScreen'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

// Static segment, same shape as the sibling quests/map.tsx: Expo Router matches
// /quests/scenario here before [city], so the DIY landing is never taken for a
// city alias. Keep the route module tiny — the screen pulls its own deps.

export default function QuestScenarioRoute() {
  return <QuestScenarioScreenImpl />
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/quests/scenario')
}
