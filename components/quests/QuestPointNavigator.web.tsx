// components/quests/QuestPointNavigator.web.tsx
// Web has no device compass / heading sensor — render nothing.
// Distance-only would require continuous geolocation which is intrusive on web;
// keep it simple and safe: no-op so the web bundle never touches sensor APIs.

export type QuestPointNavigatorProps = {
  targetLat: number
  targetLng: number
  colors: any
}

export default function QuestPointNavigator(_props: QuestPointNavigatorProps): null {
  return null
}
