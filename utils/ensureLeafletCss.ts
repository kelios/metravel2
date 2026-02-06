export function ensureLeafletCss(): boolean {
  if (typeof document === 'undefined') return false

  try {
    const id = 'metravel-leaflet-css'
    if (document.getElementById(id)) return true

    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.setAttribute('data-metravel-leaflet-css', 'cdn')
    document.head.appendChild(link)
    return true
  } catch {
    return false
  }
}

