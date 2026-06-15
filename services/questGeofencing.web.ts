// services/questGeofencing.web.ts
// Web has no OS geofencing / background location — all exports no-op.

export type GeofenceStep = {
  id: string;
  lat: number;
  lng: number;
  index: number;
  title?: string;
};

export async function startQuestGeofencing(
  _questId: string,
  _cityId: string,
  _title: string,
  _steps: GeofenceStep[],
): Promise<void> {
  // no-op on web
}

export async function stopQuestGeofencing(): Promise<void> {
  // no-op on web
}
