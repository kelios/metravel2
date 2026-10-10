import { API_BASE_URL, DEFAULT_TIMEOUT } from '@/api/apiConfig';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { buildQuestLocalePath, validateQuestServingProjection,
  type QuestServingIdentity, type QuestServingProjection } from '@/utils/questLocaleRouting';

/** Anonymous live publication read; 404/503 are explicit states, never a cached success. */
export async function fetchQuestServing(
  identity: QuestServingIdentity, signal?: AbortSignal,
): Promise<QuestServingProjection> {
  if (!buildQuestLocalePath(identity.cityId, identity.questSlug, identity.locale)) {
    throw new Error('Invalid quest serving identity');
  }
  const url = `${API_BASE_URL.replace(/\/$/, '')}/quests/serving/${identity.cityId}/${identity.questSlug}/?lang=${identity.locale}`;
  const response = await fetchWithTimeout(url, {
    credentials: 'omit', cache: 'no-store', signal, headers: { Accept: 'application/json' },
  }, DEFAULT_TIMEOUT);
  const projection = validateQuestServingProjection(await response.json(), identity);
  if (!projection || (response.status === 200 && projection.state !== 'available')
    || (response.status === 404 && projection.state !== 'unavailable')
    || (response.status === 503 && projection.state !== 'temporary_failure')
    || ![200, 404, 503].includes(response.status)) throw new Error('Invalid quest serving response');
  return projection;
}
