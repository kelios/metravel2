// components/quests/useQuestGeofence.web.ts
// Web has no OS geofencing / background location — no-op.

type QuestStepWithCoords = {
  id: string;
  title?: string;
  lat: number;
  lng: number;
};

type QuestGeofenceParams = {
  questId?: string;
  cityId?: string;
  title: string;
  steps: QuestStepWithCoords[];
  answers: Record<string, string>;
  allCompleted: boolean;
};

export function useQuestGeofence(_params: QuestGeofenceParams): void {
  // no-op on web
}
