// CDN fallbacks (pinned to the installed versions) for when the self-hosted
// /vendor/*.css files are not served — e.g. prod returns the SPA 404 HTML for
// /vendor/leaflet.css, so the browser refuses the stylesheet and Leaflet popups
// render unstyled/mispositioned. CSP `style-src` already allows unpkg.com.
import { getOsmTileUrl } from '@/config/mapWebLayers'
import { LEAFLET_CSS } from '@/utils/leafletCssAsset'

const LEAFLET_CSS_CDN = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const MARKERCLUSTER_CSS_CDN = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'

// Persist state on the DOM link: the HTML bootstrap can finish both requests
// before this module (or a readiness subscriber) is loaded.
const observedLinks = new WeakSet<HTMLLinkElement>()
function withCdnFallback(link: HTMLLinkElement, cdnHref: string): void {
  if (observedLinks.has(link)) return
  observedLinks.add(link)
  if (!link.hasAttribute('data-css-state')) {
    link.setAttribute('data-css-state', link.sheet ? 'loaded' : 'loading')
  }
  link.onload = () => link.setAttribute('data-css-state', 'loaded')
  link.onerror = () => {
    if (link.getAttribute('data-css-fallback') === 'cdn') {
      link.setAttribute('data-css-state', 'failed')
      return
    }
    link.setAttribute('data-css-fallback', 'cdn')
    link.setAttribute('data-css-state', 'loading')
    link.href = cdnHref
  }
}

export function ensureLeafletCss(): boolean {
  if (typeof document === 'undefined') return false

  try {
    const id = LEAFLET_CSS_LINK_ID
    const existing = document.getElementById(id) as HTMLLinkElement | null
    if (existing) {
      withCdnFallback(existing, LEAFLET_CSS_CDN)
      ensureMarkerClusterCss()
      ensureLeafletOverrides()
      ensureTilePreconnect()
      return true
    }

    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = '/vendor/leaflet.css'
    link.setAttribute('data-metravel-leaflet-css', 'self-hosted')
    withCdnFallback(link, LEAFLET_CSS_CDN)
    document.head.appendChild(link)

    // Inject MarkerCluster CSS
    ensureMarkerClusterCss()

    // Inject Leaflet overrides (extracted from global.css to reduce CSS on non-map pages)
    ensureLeafletOverrides()

    // Add preconnect for tile server (only needed on map page)
    ensureTilePreconnect()

    return true
  } catch {
    return false
  }
}

const LEAFLET_CSS_LINK_ID = 'metravel-leaflet-css'
const LEAFLET_FALLBACK_STYLE_SELECTOR = 'style[data-leaflet-fallback="true"]'
const LEAFLET_CSS_READY_TIMEOUT_MS = 1000

const leafletCssReadyPromises = new WeakMap<HTMLLinkElement, Promise<void>>()

/**
 * Leaflet core CSS реально применён к документу (а не только вставлен `<link>`):
 * leaflet.css задаёт `.leaflet-pane { z-index: 400 }` (у `.leaflet-map-pane` своего
 * z-index нет — прежняя проба в useLeafletLoader поэтому не видела настоящий CSS).
 */
export function isLeafletCoreCssApplied(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  try {
    const probe = document.createElement('div')
    probe.className = 'leaflet-pane'
    probe.style.position = 'absolute'
    probe.style.top = '-9999px'
    probe.style.left = '-9999px'
    document.body.appendChild(probe)
    const z = window.getComputedStyle(probe).zIndex
    probe.remove()
    return z === '400'
  } catch {
    return false
  }
}

/**
 * Use the exact pinned vendor stylesheet, rather than a second partial layout.
 * Late vendor CSS therefore cannot add missing margins, control dimensions,
 * typography, borders or popup geometry. Inline URLs resolve from the page, so
 * adapt their base to the same /vendor/ directory as the self-hosted stylesheet.
 */
function injectLeafletLayoutFallback(): void {
  if (document.querySelector(LEAFLET_FALLBACK_STYLE_SELECTOR)) return
  const style = document.createElement('style')
  style.setAttribute('data-leaflet-fallback', 'true')
  style.textContent = LEAFLET_CSS.replace(/url\(images\//g, 'url(/vendor/images/')
  document.head.appendChild(style)
}

export interface WhenLeafletCssReadyOptions {
  /** Верхняя граница ожидания (не более 1000 ms); дальше применяется vendor CSS. */
  timeoutMs?: number
  /**
   * В Jest/JSDOM внешние стили не грузятся: по умолчанию сразу подкладываем
   * раскладку и не держим движок. `true` — проверить настоящее ожидание.
   */
  waitInTestEnv?: boolean
}

/**
 * Контракт «первый кадр карты = итоговая геометрия» (#2324): движок Leaflet
 * нельзя монтировать, пока core CSS не применён. Иначе первые кадры рисуются
 * с тайлами/SVG/контролами в обычном потоке (тайлы столбиком под контейнером),
 * а приход leaflet.css переставляет их в `position:absolute` — layout shift.
 *
 * Вставляет стили (как `ensureLeafletCss`) и резолвится, когда leaflet.css
 * применён (load self-hosted или CDN-фолбэка) либо по таймауту — тогда с
 * полной vendor-раскладкой. Никогда не реджектится: CSS не должен ронять карту.
 */
export function whenLeafletCssReady(options: WhenLeafletCssReadyOptions = {}): Promise<void> {
  const { timeoutMs = LEAFLET_CSS_READY_TIMEOUT_MS, waitInTestEnv = false } = options
  if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve()

  ensureLeafletCss()
  if (isLeafletCoreCssApplied()) return Promise.resolve()

  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
  const link = document.getElementById(LEAFLET_CSS_LINK_ID) as HTMLLinkElement | null
  const state = link?.getAttribute('data-css-state')
  if ((isTestEnv && !waitInTestEnv) || !link || state === 'failed' || state === 'loaded') {
    // A load without core rules is also terminal (e.g. wrong stylesheet content).
    injectLeafletLayoutFallback()
    return Promise.resolve()
  }

  const pending = leafletCssReadyPromises.get(link)
  if (pending) return pending

  const deadline = Number.isFinite(timeoutMs)
    ? Math.min(LEAFLET_CSS_READY_TIMEOUT_MS, Math.max(0, timeoutMs))
    : LEAFLET_CSS_READY_TIMEOUT_MS
  const promise = new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      link.removeEventListener('load', onLoad)
      link.removeEventListener('error', onError)
      leafletCssReadyPromises.delete(link)
      resolve()
    }
    function onLoad() {
      if (!isLeafletCoreCssApplied()) injectLeafletLayoutFallback()
      finish()
    }
    const onError = () => {
      if (link.getAttribute('data-css-state') !== 'failed') return
      injectLeafletLayoutFallback()
      finish()
    }

    const timer = setTimeout(() => {
      if (!isLeafletCoreCssApplied()) injectLeafletLayoutFallback()
      finish()
    }, deadline)
    link.addEventListener('load', onLoad)
    link.addEventListener('error', onError)
  })
  leafletCssReadyPromises.set(link, promise)
  return promise
}

function ensureMarkerClusterCss(): void {
  const id = 'metravel-markercluster-css'
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = '/vendor/MarkerCluster.css'
    withCdnFallback(link, MARKERCLUSTER_CSS_CDN)
    document.head.appendChild(link)
  } else {
    withCdnFallback(document.getElementById(id) as HTMLLinkElement, MARKERCLUSTER_CSS_CDN)
  }

  if (document.getElementById('metravel-markercluster-overrides')) return

  // Custom cluster styles instead of the default blue/green/yellow circles
  const style = document.createElement('style')
  style.id = 'metravel-markercluster-overrides'
  style.textContent = getMarkerClusterOverridesCSS()
  document.head.appendChild(style)
}

function getMarkerClusterOverridesCSS(): string {
  return [
    '.marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:var(--color-primary-30,#7a9d8f30)!important;border-radius:50%!important}',
    '.marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{background:linear-gradient(145deg,var(--color-primary,#7a9d8f) 0%,var(--color-primaryDark,#6a8d7f) 100%)!important;color:var(--color-textOnDark,#ffffff)!important;border:3px solid rgba(255,255,255,0.96)!important;border-radius:50%!important;font-weight:800!important;font-size:14px!important;font-family:Inter,system-ui,-apple-system,sans-serif!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:var(--shadow-medium)!important}',
    '.marker-cluster-small{width:36px!important;height:36px!important}',
    '.marker-cluster-small div{width:28px!important;height:28px!important;margin-left:4px!important;margin-top:4px!important;line-height:28px!important}',
    '.marker-cluster-medium{width:44px!important;height:44px!important}',
    '.marker-cluster-medium div{width:34px!important;height:34px!important;margin-left:5px!important;margin-top:5px!important;line-height:34px!important;font-size:15px!important}',
    '.marker-cluster-large{width:52px!important;height:52px!important}',
    '.marker-cluster-large div{width:40px!important;height:40px!important;margin-left:6px!important;margin-top:6px!important;line-height:40px!important;font-size:16px!important}',
    '.marker-cluster{box-shadow:var(--shadow-card)!important;cursor:pointer!important;transition:box-shadow 0.15s ease,filter 0.15s ease!important}',
    '.marker-cluster:hover{box-shadow:var(--shadow-hover)!important;filter:brightness(1.03)!important}',
    '.leaflet-cluster-anim .leaflet-marker-icon,.leaflet-cluster-anim .leaflet-marker-shadow{transition:transform 0.3s ease-out,opacity 0.3s ease-out!important}',
    '@keyframes metravelClusterPulse{0%,100%{transform:scale(0.92);opacity:0.46}50%{transform:scale(1.04);opacity:0.74}}',
    '@keyframes metravelUserPulse{0%{transform:scale(0.6);opacity:0.5}70%{opacity:0}100%{transform:scale(2.6);opacity:0}}',
  ].join('\n')
}

function ensureLeafletOverrides(): void {
  const id = 'metravel-leaflet-overrides'
  if (document.getElementById(id)) return

  const style = document.createElement('style')
  style.id = id
  style.textContent = getLeafletOverridesCSS()
  document.head.appendChild(style)
}

function ensureTilePreconnect(): void {
  const id = 'metravel-tile-preconnect'
  if (document.getElementById(id)) return

  // Preconnect к реальному origin tile-прокси (#989), а не к прямому OSM.
  // На проде getOsmTileUrl() отдаёт same-origin путь (`/proxy/tiles/...`) —
  // preconnect не нужен (origin уже установлен). На localhost/Metro URL
  // абсолютный (публичный прод) — тогда preconnect к его origin ускоряет тайлы.
  let tileOrigin: string | null = null
  try {
    const url = getOsmTileUrl()
    if (/^https?:\/\//i.test(url)) tileOrigin = new URL(url).origin
  } catch {
    tileOrigin = null
  }
  if (!tileOrigin) return

  const link = document.createElement('link')
  link.id = id
  link.rel = 'preconnect'
  link.href = tileOrigin
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

function getLeafletOverridesCSS(): string {
  return [
    // An embedded map may own its themed canvas background. The override must
    // be consumed by every important rule below, including the mobile theme rule.
    '.leaflet-container{background-color:var(--metravel-map-background,var(--color-backgroundTertiary))!important;background-image:none!important}',
    // Светлая тема: пока тайл догружается при зуме, в зазоре виден мягкий «земляной»
    // тон карты, а не серо-белая «шахматка» контейнера. В тёмной теме оставляем
    // backgroundTertiary — он совпадает с инвертированными (тёмными) тайлами ниже.
    'html:not([data-theme="dark"]) .leaflet-container{background-color:var(--metravel-map-background,#e8ebe4)!important}',
    // Инверсия тайлов в тёмной теме — только desktop (≥768px): на устройстве
    // (native WebView-карта) тайлы всегда светлые, mobile web выглядит так же.
    '@media (min-width: 768px){html[data-theme="dark"] .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.85)}}',
    // На мобильном в тёмной теме фон контейнера под светлые тайлы, чтобы в зазорах
    // при зуме не мигал тёмный фон.
    '@media (max-width: 767.98px){html[data-theme="dark"] .leaflet-container{background-color:var(--metravel-map-background,#e8ebe4)!important}}',
    '.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-tile,.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important;object-fit:none!important;image-rendering:auto!important}',
    '.leaflet-container img.leaflet-marker-icon,.leaflet-container img.leaflet-marker-shadow{max-width:none!important;max-height:none!important;object-fit:none!important}',
    '.leaflet-container svg{max-width:none!important;max-height:none!important}',
    '.leaflet-control-container{contain:none!important}',
    '[data-testid="map-container"],[data-testid="map-leaflet-wrapper"]{contain:none!important}',
    '.leaflet-popup-content-wrapper{border-radius:16px!important;background:var(--color-surface)!important;border:1px solid var(--color-border)!important;box-shadow:var(--shadow-modal)!important}',
    ".leaflet-popup-content{margin:0!important;padding:14px!important;color:var(--color-text)!important;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important;font-size:14px!important;line-height:20px!important;max-width:min(420px,calc(100vw - 32px))!important}",
    '.leaflet-popup{max-width:calc(100vw - 24px)!important}',
    // `--metravel-popup-max-h` is set per-map (popupopen handlers) to the embedded
    // map container's own height. Без него cap считается от 100dvh (всего окна), и на
    // странице путешествия, где карта — невысокая секция, карточка вырастает выше
    // карты, autoPan не может её вместить, и верх (ФОТО) обрезается краем карты.
    '.leaflet-popup.metravel-place-popup .leaflet-popup-content-wrapper{border-radius:28px!important;background:transparent!important;border:0!important;box-shadow:none!important;max-height:min(680px,calc(100dvh - 144px),var(--metravel-popup-max-h,100dvh))!important;overflow:hidden!important}',
    // Popup content is a non-scrolling flex column capped by max-height; the inner
    // split body (.splitScroll) carries the scroll, so expanding «Ещё» scrolls only the
    // caption/actions UNDER the fixed hero photo. Image-less / stacked popups stay short,
    // so the cap with overflow:hidden never clips them.
    '.leaflet-popup.metravel-place-popup .leaflet-popup-content{padding:0!important;max-width:min(var(--metravel-popup-content-max-width,352px),calc(100vw - 32px))!important;border-radius:28px!important;max-height:min(660px,calc(100dvh - 160px),var(--metravel-popup-max-h,100dvh))!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}',
    '.leaflet-popup.metravel-place-popup .leaflet-popup-tip{background:transparent!important;border:0!important;box-shadow:none!important}',
    '.leaflet-popup.metravel-place-popup .leaflet-popup-close-button{top:12px!important;right:12px!important;margin:0!important;width:36px!important;height:36px!important;line-height:34px!important;background:var(--color-surface)!important;color:var(--color-text)!important;border:1px solid var(--color-border)!important;box-shadow:0 10px 22px rgba(15,23,42,0.18)!important;z-index:30!important;pointer-events:auto!important}',
    ".leaflet-tooltip.metravel-route-marker-tooltip{background:var(--color-surface)!important;border:1px solid var(--color-border)!important;border-radius:6px!important;box-shadow:var(--shadow-medium)!important;padding:4px 8px!important;font-size:11px!important;line-height:16px!important;font-weight:500!important;color:var(--color-text)!important;white-space:nowrap!important;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important}",
    '.leaflet-tooltip.metravel-route-marker-tooltip::before{border-top-color:var(--color-border)!important}',
    ".leaflet-tooltip.metravel-marker-tooltip{background:var(--color-surface)!important;border:1px solid var(--color-border)!important;border-radius:8px!important;box-shadow:var(--shadow-medium)!important;padding:4px 10px!important;font-size:12px!important;line-height:18px!important;font-weight:600!important;color:var(--color-text)!important;white-space:nowrap!important;max-width:220px!important;overflow:hidden!important;text-overflow:ellipsis!important;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important}",
    '.leaflet-tooltip.metravel-marker-tooltip::before{border-top-color:var(--color-border)!important}',
    '.leaflet-popup.metravel-route-marker-popup{max-width:min(100px,calc(100vw - 48px))!important}',
    '.leaflet-popup.metravel-route-marker-popup .leaflet-popup-content-wrapper{border-radius:999px!important;padding:0!important}',
    '.leaflet-popup.metravel-route-marker-popup .leaflet-popup-content{max-width:min(80px,calc(100vw - 80px))!important;padding:4px 8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px!important;line-height:16px!important;font-weight:500!important;text-align:center!important;margin:0!important}',
    '.leaflet-popup.metravel-route-marker-popup .leaflet-popup-close-button{display:none!important}',
    '.leaflet-popup-tip{background:var(--color-surface)!important;border:1px solid var(--color-border)!important;box-shadow:var(--shadow-medium)!important}',
    '.leaflet-popup-close-button{width:32px!important;height:32px!important;border-radius:999px!important;margin:6px!important;color:var(--color-textMuted)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
    '.leaflet-popup-close-button:hover{background:var(--color-backgroundTertiary)!important;color:var(--color-text)!important}',
    '.leaflet-control{z-index:800!important}',
    // Reserve complete default credit before deferred base-layer attachment.
    // Two 1.35em lines plus the existing 4px padding keep the prefix-only
    // and complete OSM credit equally tall when a narrow map wraps the text.
    // The corner is constrained by its own map, including embedded narrow maps.
    '.leaflet-container .leaflet-bottom{max-width:100%}',
    '.leaflet-container .leaflet-control-attribution{box-sizing:border-box!important;width:220px;max-width:100%;min-height:calc(2.7em + 4px);font-family:"Helvetica Neue",Arial,Helvetica,sans-serif!important;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}',
    '.leaflet-control-attribution{z-index:900!important;margin-bottom:4px!important;padding:2px 6px!important;border-radius:10px!important;font-size:11px!important;line-height:1.35!important;color:var(--color-textMuted)!important;background:rgba(255,255,255,0.88)!important}',
    'html[data-theme="dark"] .leaflet-control-attribution{background:rgba(42,42,42,0.88)!important}',
    '.leaflet-control-attribution a{color:var(--color-textMuted)!important}',
    '@media(min-width:900px){.leaflet-bottom.leaflet-right{right:0!important}}',
    '.leaflet-tooltip{z-index:650!important}',
    '@media(pointer:coarse){.leaflet-marker-icon{min-width:44px!important;min-height:44px!important}.leaflet-popup-close-button{width:44px!important;height:44px!important;font-size:24px!important}.leaflet-popup-content{max-height:60vh!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}.leaflet-tooltip{pointer-events:none!important}}',
    '.leaflet-marker-icon,.leaflet-marker-shadow{touch-action:manipulation!important}',
    '.leaflet-popup-pane{touch-action:auto!important}',
  ].join('\n')
}
