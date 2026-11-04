import { filterPublished, unwrapTravelsList } from '@/api/travelQueryShared'
import { normalizeTravelItem } from '@/api/travelsNormalize'
import { getTravelCardWebCover, isLikelyWatermarked } from '@/components/listTravel/travelCardCover'
import { BREAKPOINTS } from '@/components/listTravel/travelCatalogGeometry'
import { readRememberedCatalogSort } from '@/components/listTravel/utils/catalogSort'
import { hasDefaultListDensity } from '@/stores/listViewPersistence'
import { familyRouteOfMediaUrl } from '@/utils/mediaUrl'
import { appendReturnToParam } from '@/utils/navigationReturnPath'
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers'
import { isTravelDraft } from '@/utils/travelDraftStatus'
import { getMediaPlaceholderData, resolveManifestImageRungs } from '@/utils/travelMediaVariants'
import { TRAVEL_LIST_FILTER_PARAM_KEYS, TRAVEL_LIST_PRELOAD_GLOBAL, type TravelListPreloadEntry } from '@/utils/travelListPreload'

function isOwnCoverUrl(raw: string, origin: string) {
  const url = new URL(raw, origin)
  const family = familyRouteOfMediaUrl(url.href)
  return url.origin === origin && !url.username && !url.password &&
    (family === 'travel-image' || family === 'gallery')
}

export function getSearchFirstResult(payload: unknown, origin: string, slotWidth: number) {
  const cardWidth = Math.round(slotWidth)
  if (!Number.isFinite(cardWidth) || cardWidth < 1) return null
  if (payload && typeof payload === 'object' && ('stage' in payload || 'strict_count' in payload || 'removed_filter_keys' in payload)) {
    // A default, unfiltered catalogue has no broadened stage. Only preview
    // an affirmative complete strict response (legacy arrays omit metadata).
    const { stage, strict_count, removed_filter_keys } = payload as Record<string, unknown>
    if (stage !== 'strict' || typeof strict_count !== 'number' || !Number.isInteger(strict_count) ||
        strict_count < 1 || !Array.isArray(removed_filter_keys) || removed_filter_keys.length) return null
  }

  const { items } = unwrapTravelsList(payload)
  // Only a genuinely usable first result can occupy the first slot. Advancing
  // to a later item if the first has an unsupported cover breaks the handoff.
  const travel = filterPublished(items.map(normalizeTravelItem))[0]
  if (!travel?.slug || !travel.name || isTravelDraft(travel) || !travel.travel_image_thumb_url ||
      isLikelyWatermarked(travel.travel_image_thumb_url)) return null

  const cover = travel.media?.cover
  if (!cover) return null
  const rungs = resolveManifestImageRungs(cover)
  if (!rungs.length || !rungs.every(({ url }) => isOwnCoverUrl(url, origin))) return null

  const image = getTravelCardWebCover(cover, cardWidth, cardWidth, cardWidth, true)
  if (!image || !isOwnCoverUrl(image.src, origin)) return null

  const href = appendReturnToParam(resolveTravelUrl(travel), '/search')
  const destination = new URL(href, origin)
  if (destination.origin !== origin || !destination.pathname.startsWith('/travels/')) return null

  return {
    href,
    image,
    title: travel.name,
    background: getMediaPlaceholderData(cover).dominantColor,
  }
}

function canShowSearchFirstResult() {
  const params = new URLSearchParams(window.location.search)
  return window.innerWidth > 0 && window.innerWidth < BREAKPOINTS.MOBILE &&
    /^\/search\/?$/.test(window.location.pathname) &&
    // A storage shim cannot establish an anonymous session. Do not show
    // public results before the identity and remembered sort can be ruled out.
    window.localStorage instanceof Storage && window.sessionStorage instanceof Storage &&
    !window.localStorage.getItem('userId') && !readRememberedCatalogSort() &&
    hasDefaultListDensity(window.localStorage) &&
    !TRAVEL_LIST_FILTER_PARAM_KEYS.some(key => params.has(key)) &&
    !document.getElementById('root')?.hasAttribute('data-first-screen-ready')
}

export async function mountSearchFirstResult() {
  try {
    if (!canShowSearchFirstResult()) return
    const shell = document.getElementById('ssg-skeleton')
    const card = shell?.querySelector('.ssg-search-card')
    const media = card?.querySelector<HTMLElement>('.ssg-search-card-media')
    const title = card?.querySelector('.ssg-search-card-title')
    if (!shell || !card || !media || !title) return

    const boot = (window as unknown as Record<string, TravelListPreloadEntry | undefined>)[TRAVEL_LIST_PRELOAD_GLOBAL]
    const response = await boot?.response
    if (!response?.ok || response.bodyUsed) return
    const payload: unknown = await response.clone().json()
    if (!shell.isConnected || !canShowSearchFirstResult()) return
    const result = getSearchFirstResult(payload, window.location.origin, card.getBoundingClientRect().width)
    if (!result) return

    const image = document.createElement('img')
    image.alt = ''
    image.decoding = 'async'
    image.fetchPriority = 'high'
    if (result.image.sizes) image.sizes = result.image.sizes
    if (result.image.srcSet) image.srcset = result.image.srcSet
    image.src = result.image.src
    image.addEventListener('error', () => {
      image.remove()
      media.classList.add('ssg-pulse')
    }, { once: true })

    const link = document.createElement('a')
    link.className = 'ssg-search-card ssg-search-card-result'
    link.href = result.href
    title.textContent = result.title
    media.classList.remove('ssg-pulse')
    if (result.background) media.style.backgroundColor = result.background
    media.replaceChildren(image)
    link.append(...Array.from(card.childNodes))
    card.replaceWith(link)
  } catch {
    // Storage failures, malformed public data and shell races use the normal
    // skeleton. The existing fetch response remains owned by React Query.
  }
}
