// CDN fallbacks (pinned to the installed versions) for when the self-hosted
// /vendor/*.css files are not served — e.g. prod returns the SPA 404 HTML for
// /vendor/leaflet.css, so the browser refuses the stylesheet and Leaflet popups
// render unstyled/mispositioned. CSP `style-src` already allows unpkg.com.
const LEAFLET_CSS_CDN = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const MARKERCLUSTER_CSS_CDN = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'

// Attaches an onerror handler that swaps the href to a CDN copy once, so a
// missing/misserved self-hosted file degrades to the CDN instead of breaking the map.
function withCdnFallback(link: HTMLLinkElement, cdnHref: string): void {
  link.onerror = () => {
    if (link.getAttribute('data-css-fallback') === 'cdn') return
    link.setAttribute('data-css-fallback', 'cdn')
    link.href = cdnHref
  }
}

export function ensureLeafletCss(): boolean {
  if (typeof document === 'undefined') return false

  try {
    const id = 'metravel-leaflet-css'
    if (document.getElementById(id)) {
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

function ensureMarkerClusterCss(): void {
  const id = 'metravel-markercluster-css'
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = '/vendor/MarkerCluster.css'
    withCdnFallback(link, MARKERCLUSTER_CSS_CDN)
    document.head.appendChild(link)
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

  const link = document.createElement('link')
  link.id = id
  link.rel = 'preconnect'
  link.href = 'https://tile.openstreetmap.org'
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

function getLeafletOverridesCSS(): string {
  return [
    '.leaflet-container{background-color:var(--color-backgroundTertiary)!important;background-image:none!important}',
    // Светлая тема: пока тайл догружается при зуме, в зазоре виден мягкий «земляной»
    // тон карты, а не серо-белая «шахматка» контейнера. В тёмной теме оставляем
    // backgroundTertiary — он совпадает с инвертированными (тёмными) тайлами ниже.
    'html:not([data-theme="dark"]) .leaflet-container{background-color:#e8ebe4!important}',
    'html[data-theme="dark"] .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.85)}',
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
