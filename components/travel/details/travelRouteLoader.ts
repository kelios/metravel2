import type { ImmutableRequest } from 'expo-server'
import { normalizeTravelItem } from '@/api/travelsNormalize'
import type { Travel } from '@/types/types'
import { normalizeTravelRouteSegment } from '@/utils/travelRouteSegment'
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData'
import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { fetchPublicRouteJson, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson'
import { buildTravelSeoDescription } from '@/utils/travelSeoDescription'
import { buildTravelFaqJsonLd } from '@/utils/travelFaq'
import type { TravelLoaderPayload } from './travelLoaderData'
import { loadTravelLinkGraph } from './travelLinkGraphLoader'

const INITIAL_TRAVEL_FIELDS = [
  'id', 'slug', 'name', 'title', 'travel_image_thumb_url', 'travel_image_thumb_small_url',
  'travel_image_detail_hd_url', 'travelImageDetailHdUrl',
  'travel_image_print_url', 'url', 'youtube_link', 'userName', 'authorRank', 'description',
  'meta_description', 'recommendation', 'plus', 'minus', 'rich_text', 'cityName', 'countryName',
  'countUnicIpView', 'rating', 'rating_count', 'comment_count', 'comments_count', 'thread_id',
  'comment_thread_id', 'gallery', 'travelAddress', 'userIds', 'year', 'monthName', 'number_days',
  'companions', 'coordsMeTravel', 'countryCode', 'user', 'created_at', 'updated_at', 'publish',
  'moderation', 'publication_status', 'engagementStats', 'authorName', 'date_create', 'date_update',
  'datePublished', 'dateModified', 'media',
] as const

export function resolveTravelLoaderSegment(value: string | string[] | undefined): string | null {
  const segment = normalizeTravelRouteSegment(Array.isArray(value) ? value[0] : value)
  if (!segment || segment.length > 250 || /[\s/\\%[\]]/.test(segment)
      || [...segment].some((character) => character.charCodeAt(0) < 32)) return null
  if (/^(?:null|undefined)$/i.test(segment)) return null
  if (/^\d+$/.test(segment) && (!Number.isSafeInteger(Number(segment)) || Number(segment) <= 0)) return null
  return segment
}

/** Keep the cover manifest and one canonical copy of the article body in loader JSON. */
export function projectTravelLoaderPayload(raw: Record<string, unknown>, routeKey: string): NonNullable<TravelLoaderPayload> {
  const media = raw.media as Travel['media']
  const normalized = normalizeTravelItem({ ...raw, media: media?.cover ? { cover: media.cover } : null })
  const fields: Record<string, unknown> = {}
  for (const key of INITIAL_TRAVEL_FIELDS) {
    const value = (normalized as unknown as Record<string, unknown>)[key]
    if (value !== undefined) fields[key] = value
  }
  fields.meta_description = buildTravelSeoDescription(normalized, normalized.description, normalized.meta_description)
  const richText = normalized.rich_text
  const safeDescription = richText?.description?.safe_html?.trim()
    ? richText.description.safe_html
    : sanitizeRichText(normalized.description)
  const serverDescriptionSanitized = typeof safeDescription === 'string' && Boolean(safeDescription.trim())
  if (serverDescriptionSanitized) {
    fields.description = safeDescription
    const { description: _description, ...otherBlocks } = richText ?? {}
    fields.rich_text = Object.keys(otherBlocks).length ? otherBlocks : undefined
  }
  const mediaPartial = Boolean(media && (media.gallery != null || media.address_images != null || media.article_body != null))
  return {
    travel: fields as unknown as Travel,
    routeKey,
    mediaPartial,
    serverDescriptionSanitized,
    // Same input as the static generator: safe_html drops the data-faq/itemprop FAQ markers.
    faqJsonLd: buildTravelFaqJsonLd(normalized.description),
  }
}

export async function loadTravelRoute(
  request: ImmutableRequest | undefined,
  params: Record<string, string | string[]>,
): Promise<TravelLoaderPayload> {
  if (!request || process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR !== 'true') return null
  const segment = resolveTravelLoaderSegment(params.param)
  if (!segment) throw publicRouteError(404)
  // Numeric URLs are the author's authenticated preview boundary. Django
  // resolves document requests; SPA previews keep their credential-aware query.
  if (/^\d+$/.test(segment)) return null
  return memoizePublicRouteData(request, `travel:${segment}`, async () => {
    const raw = await fetchPublicRouteJson(request, `travels/by-slug/${encodeURIComponent(segment)}/`)
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw publicRouteError(503)
      const record = raw as Record<string, unknown>
      if ([record.publish, record.moderation].some((value) => value === false || value === 0 || value === '0')
          || (record.publication_status != null && record.publication_status !== 'published')) {
        throw publicRouteError(404)
      }
      const payload = projectTravelLoaderPayload(record, segment)
      if (!payload.travel.id || !payload.travel.name) throw publicRouteError(503)
      payload.linkGraph = await loadTravelLinkGraph(request, payload.travel.id)
      return payload
    } catch (error) {
      if (error instanceof Error && 'httpStatus' in error) throw error
      throw publicRouteError(503)
    }
  })
}
