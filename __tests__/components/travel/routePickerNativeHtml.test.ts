import { buildRoutePickerNativeHtml } from '@/components/travel/stepRoute/routePickerNativeHtml'

// #1040 — редактируемая карта выбора точек маршрута на native. Билдер чистый,
// поэтому контракт моста RN↔WebView проверяем без рендера WebView.
describe('buildRoutePickerNativeHtml', () => {
  const build = () =>
    buildRoutePickerNativeHtml({
      center: [53.9006, 27.559],
      initialZoom: 12,
      birdMarkerHtml: '<i data-bird="1"></i>',
      routeColor: '#ff8a3d',
    })

  it('renders a complete Leaflet document centred on the given coordinates', () => {
    const html = build()

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<div id="map"></div>')
    expect(html).toContain('setView([53.9006, 27.559], 12)')
  })

  it('exposes the RN → WebView command bridge', () => {
    const html = build()

    expect(html).toContain('window.__mtRouteSetPoints')
    expect(html).toContain('window.__mtRouteFlyTo')
    expect(html).toContain('window.__mtRouteFit')
  })

  it('reports point add / move / select back to RN', () => {
    const html = build()

    expect(html).toContain("type: 'POINT_ADD'")
    expect(html).toContain("type: 'POINT_MOVE'")
    expect(html).toContain("type: 'POINT_SELECT'")
    expect(html).toContain("type: 'MAP_READY'")
  })

  it('creates draggable markers so a point can be moved on the map', () => {
    const html = build()

    expect(html).toContain('draggable: true')
    expect(html).toContain("marker.on('dragend'")
  })

  // Регрессия: Leaflet на Android эмитит «призрачный» click после тапа по маркеру
  // и после перетаскивания. Без гварда каждое такое действие создавало бы ещё
  // одну точку поверх существующей.
  it('guards the map click against ghost clicks after marker interaction', () => {
    const html = build()

    expect(html).toContain('suppressMapClickUntil')
    expect(html).toContain('if (Date.now() < suppressMapClickUntil) return;')
  })

  it('embeds the shared brand marker html', () => {
    const html = build()

    expect(html).toContain('data-bird=\\"1\\"')
  })
})
