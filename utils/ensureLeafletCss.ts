export function ensureLeafletCss(): boolean {
  if (typeof document === 'undefined') return false

  try {
    const id = 'metravel-leaflet-css'
    if (document.getElementById(id)) return true

    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = '/vendor/leaflet.css'
    link.setAttribute('data-metravel-leaflet-css', 'self-hosted')
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
  if (document.getElementById(id)) return

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = '/vendor/MarkerCluster.css'
  document.head.appendChild(link)

  // Custom cluster styles instead of the default blue/green/yellow circles
  const style = document.createElement('style')
  style.id = 'metravel-markercluster-overrides'
  style.textContent = getMarkerClusterOverridesCSS()
  document.head.appendChild(style)
}

function getMarkerClusterOverridesCSS(): string {
  return [
    '.marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:rgba(255,138,0,0.2)!important;border-radius:50%!important}',
    '.marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{background:var(--color-primary,#ff8a00)!important;color:#fff!important;border-radius:50%!important;font-weight:800!important;font-size:14px!important;font-family:Inter,system-ui,-apple-system,sans-serif!important;display:flex!important;align-items:center!important;justify-content:center!important}',
    '.marker-cluster-small{width:36px!important;height:36px!important}',
    '.marker-cluster-small div{width:28px!important;height:28px!important;margin-left:4px!important;margin-top:4px!important;line-height:28px!important}',
    '.marker-cluster-medium{width:44px!important;height:44px!important}',
    '.marker-cluster-medium div{width:34px!important;height:34px!important;margin-left:5px!important;margin-top:5px!important;line-height:34px!important;font-size:15px!important}',
    '.marker-cluster-large{width:52px!important;height:52px!important}',
    '.marker-cluster-large div{width:40px!important;height:40px!important;margin-left:6px!important;margin-top:6px!important;line-height:40px!important;font-size:16px!important}',
    '.marker-cluster{box-shadow:0 4px 16px rgba(0,0,0,0.2)!important;cursor:pointer!important;transition:box-shadow 0.15s ease,filter 0.15s ease!important}',
    '.marker-cluster:hover{box-shadow:0 6px 18px rgba(0,0,0,0.24)!important;filter:brightness(1.02)!important}',
    '.leaflet-cluster-anim .leaflet-marker-icon,.leaflet-cluster-anim .leaflet-marker-shadow{transition:transform 0.3s ease-out,opacity 0.3s ease-out!important}',
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
    '.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-tile,.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important;object-fit:none!important;image-rendering:auto!important}',
    '.leaflet-container img.leaflet-marker-icon,.leaflet-container img.leaflet-marker-shadow{max-width:none!important;max-height:none!important;object-fit:none!important}',
    '.leaflet-container svg{max-width:none!important;max-height:none!important}',
    '.leaflet-control-container{contain:none!important}',
    '[data-testid="map-container"],[data-testid="map-leaflet-wrapper"]{contain:none!important}',
    '.leaflet-popup-content-wrapper{border-radius:16px!important;background:var(--color-surface)!important;border:1px solid var(--color-border)!important;box-shadow:var(--shadow-modal)!important}',
    ".leaflet-popup-content{margin:0!important;padding:14px!important;color:var(--color-text)!important;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important;font-size:14px!important;line-height:20px!important;max-width:min(420px,calc(100vw - 32px))!important}",
    '.leaflet-popup{max-width:calc(100vw - 24px)!important}',
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
