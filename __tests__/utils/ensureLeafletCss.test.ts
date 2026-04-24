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
    expect(document.getElementById('metravel-leaflet-overrides')).toBeTruthy()
    expect(document.getElementById('metravel-tile-preconnect')).toBeTruthy()
  })
})
