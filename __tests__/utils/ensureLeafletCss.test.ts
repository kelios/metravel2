import { ensureLeafletCss } from '@/utils/ensureLeafletCss'

describe('ensureLeafletCss', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('injects map overrides when the Leaflet link was preloaded already', () => {
    const leafletLink = document.createElement('link')
    leafletLink.id = 'metravel-leaflet-css'
    leafletLink.rel = 'stylesheet'
    leafletLink.href = '/vendor/leaflet.css'
    document.head.appendChild(leafletLink)

    const markerClusterLink = document.createElement('link')
    markerClusterLink.id = 'metravel-markercluster-css'
    markerClusterLink.rel = 'stylesheet'
    markerClusterLink.href = '/vendor/MarkerCluster.css'
    document.head.appendChild(markerClusterLink)

    expect(ensureLeafletCss()).toBe(true)

    expect(document.getElementById('metravel-markercluster-css')).toBeTruthy()
    expect(
      document.getElementById('metravel-markercluster-overrides')?.textContent,
    ).toContain('@keyframes metravelClusterPulse')
    const overrides = document.getElementById('metravel-leaflet-overrides')?.textContent
    expect(overrides).toBeTruthy()
    expect(overrides).toContain('leaflet-popup-close-button')
    expect(overrides).toContain('pointer-events:auto!important')
    expect(overrides).toContain('z-index:30!important')
    expect(document.getElementById('metravel-tile-preconnect')).toBeTruthy()
  })

  it('injects self-hosted leaflet + markercluster stylesheets', () => {
    ensureLeafletCss()

    expect(document.getElementById('metravel-leaflet-css')?.getAttribute('href')).toBe(
      '/vendor/leaflet.css',
    )
    expect(document.getElementById('metravel-markercluster-css')?.getAttribute('href')).toBe(
      '/vendor/MarkerCluster.css',
    )
  })

  it('falls back to the CDN when the self-hosted leaflet css fails to load (prod 404)', () => {
    ensureLeafletCss()

    const leaflet = document.getElementById('metravel-leaflet-css') as HTMLLinkElement
    const cluster = document.getElementById('metravel-markercluster-css') as HTMLLinkElement

    // Simulate the 404 -> SPA-html response the browser refuses to apply.
    leaflet.dispatchEvent(new Event('error'))
    cluster.dispatchEvent(new Event('error'))

    expect(leaflet.getAttribute('href')).toBe('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
    expect(cluster.getAttribute('href')).toBe(
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    )
  })

  it('does not loop the fallback if the CDN copy also errors', () => {
    ensureLeafletCss()
    const leaflet = document.getElementById('metravel-leaflet-css') as HTMLLinkElement

    leaflet.dispatchEvent(new Event('error'))
    const afterFirst = leaflet.getAttribute('href')
    leaflet.dispatchEvent(new Event('error'))

    expect(leaflet.getAttribute('href')).toBe(afterFirst)
    expect(leaflet.getAttribute('data-css-fallback')).toBe('cdn')
  })
})
