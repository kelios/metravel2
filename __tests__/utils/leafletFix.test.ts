/**
 * @jest-environment jsdom
 */
import { applyLeafletFix } from '@/utils/leafletFix'

// Мини-модель Leaflet Map: getPane как в 1.9 (строка → this._panes[name]).
const makeLeafletInstance = () => {
  function FakeMap(this: any) {}
  ;(FakeMap.prototype as any).getPane = function (name?: any) {
    return typeof name === 'string' ? this._panes?.[name] : name
  }
  return { Map: FakeMap as any }
}

const makeLiveMap = (L: any) => {
  const map: any = new L.Map()
  const mapPane = document.createElement('div')
  map._mapPane = mapPane
  map._panes = { mapPane }
  map._container = document.createElement('div')
  return { map, mapPane }
}

describe('applyLeafletFix / safeGetPane', () => {
  let originalGlobalL: any

  beforeEach(() => {
    originalGlobalL = (globalThis as any).L
    ;(globalThis as any).L = undefined
  })

  afterEach(() => {
    ;(globalThis as any).L = originalGlobalL
  })

  it('на живой карте возвращает undefined для отсутствующего кастомного pane (get-or-create должен звать createPane)', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const { map, mapPane } = makeLiveMap(L)

    const result = map.getPane('metravelRoutePane')

    // Регрессия «попап не закрывается»: раньше фолбэк отдавал сам map-pane,
    // RouteLineLayer не создавал свой pane и вешал pointer-events:none на map-pane.
    expect(result).toBeUndefined()
    expect(result).not.toBe(mapPane)
  })

  it('на живой карте существующий pane возвращается как есть', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const { map } = makeLiveMap(L)
    const routePane = document.createElement('div')
    map._panes.metravelRoutePane = routePane

    expect(map.getPane('metravelRoutePane')).toBe(routePane)
    expect(map.getPane('mapPane')).toBe(map._mapPane)
  })

  it('на убитой карте (нет panes) отдаёт безопасный узел вместо undefined — защита getPane().appendChild()', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const map: any = new L.Map()
    map._panes = [] // Leaflet.remove(): this._panes = []
    // _mapPane удалён remove()'ом; _container ещё жив
    map._container = document.createElement('div')

    const fromContainer = map.getPane('markerPane')
    expect(fromContainer).toBe(map._container)

    delete map._container
    const detached = map.getPane('markerPane')
    expect(detached).toBeInstanceOf(HTMLElement)
    expect(typeof detached.appendChild).toBe('function')
  })

  it('в середине teardown с ещё живым _mapPane фолбэк остаётся на _mapPane', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const map: any = new L.Map()
    map._mapPane = document.createElement('div')
    map._panes = [] // panes уже сброшены

    expect(map.getPane('popupPane')).toBe(map._mapPane)
  })
})
