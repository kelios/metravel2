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
  map.createPane = jest.fn((name: string) => {
    const pane = document.createElement('div')
    map._panes[name] = pane
    mapPane.appendChild(pane)
    return pane
  })
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

  it('на живой карте синхронно создаёт отсутствующий кастомный pane', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const { map, mapPane } = makeLiveMap(L)

    const result = map.getPane('metravelRoutePane')

    expect(map.createPane).toHaveBeenCalledWith('metravelRoutePane')
    expect(result).toBe(map._panes.metravelRoutePane)
    expect(result.parentElement).toBe(mapPane)
    expect(() => result.appendChild(document.createElement('div'))).not.toThrow()
    expect(result).not.toBe(mapPane)
  })

  it('при ошибке createPane возвращает безопасный узел, но не общий mapPane', () => {
    const L = makeLeafletInstance()
    applyLeafletFix(L)
    const { map, mapPane } = makeLiveMap(L)
    map.createPane.mockImplementation(() => {
      throw new Error('pane race')
    })

    const result = map.getPane('metravelUserLocationPane')

    expect(result).toBeInstanceOf(HTMLElement)
    expect(result).not.toBe(mapPane)
    expect(typeof result.appendChild).toBe('function')
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
