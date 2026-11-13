import { API_BASE_URL, DEFAULT_TIMEOUT } from '@/api/apiConfig'
import { fetchPublicWithSession } from '@/api/publicFetchWithSession'

export async function recordTravelView(travelId: number): Promise<void> {
  if (!Number.isSafeInteger(travelId) || travelId <= 0) return
  try {
    await fetchPublicWithSession(
      `${API_BASE_URL}/travels/${travelId}/view/`,
      { method: 'POST' },
      DEFAULT_TIMEOUT,
      { retry: false },
    )
  } catch {
    // View recording must never interrupt reading or retry a counted request.
  }
}
