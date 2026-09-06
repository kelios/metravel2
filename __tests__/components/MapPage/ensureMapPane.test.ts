/**
 * #1813 — общий хелпер pane веб-карты. До него блок «взять-или-создать pane +
 * стили» был скопирован в трёх местах, и каждая копия должна была помнить обе
 * особенности патча `utils/leafletFix`. Тест держит контракт хелпера, чтобы
 * четвёртому потребителю не пришлось искать ловушки заново.
 */
import { ensureMapPane } from '@/components/MapPage/Map/ensureMapPane'

type FakePane = { style: Record<string, string>; isConnected?: boolean }

const makeMap = ({
  getOrCreate,
  connected = true,
  hasGetPane = true,
  hasCreatePane = true,
}: {
  getOrCreate: boolean
  connected?: boolean
  hasGetPane?: boolean
  hasCreatePane?: boolean
}) => {
  const panes: Record<string, FakePane> = {}
  const makePane = (name: string) => {
    const el: FakePane = { style: {}, isConnected: connected }
    panes[name] = el
    return el
  }
  const map: any = { panes }
  if (hasCreatePane) map.createPane = jest.fn((name: string) => makePane(name))
  // getOrCreate === true воспроизводит пропатченный getPane: он САМ создаёт
  // отсутствующий pane и возвращает его, но без стилей.
  if (hasGetPane) {
    map.getPane = jest.fn((name: string) => panes[name] ?? (getOrCreate ? makePane(name) : undefined))
  }
  return map
}

describe('ensureMapPane', () => {
  it('применяет стили, когда getPane пропатчен в get-or-create', () => {
    const map = makeMap({ getOrCreate: true })

    expect(ensureMapPane(map, 'metravel-test', { zIndex: 625, pointerEvents: 'none' })).toBe(
      'metravel-test',
    )
    // Главная ловушка: pane уже существует, ветка создания не выполняется —
    // стиль обязан примениться всё равно, иначе остаётся дефолтный z-index 400.
    expect(map.createPane).not.toHaveBeenCalled()
    expect(map.panes['metravel-test'].style.zIndex).toBe('625')
    expect(map.panes['metravel-test'].style.pointerEvents).toBe('none')
  })

  it('создаёт pane сам, когда патча нет (ванильный Leaflet)', () => {
    const map = makeMap({ getOrCreate: false })

    expect(ensureMapPane(map, 'metravel-test', { zIndex: '450' })).toBe('metravel-test')
    expect(map.createPane).toHaveBeenCalledWith('metravel-test')
    expect(map.panes['metravel-test'].style.zIndex).toBe('450')
    // pointerEvents не задан вызывающим — хелпер его не выдумывает.
    expect(map.panes['metravel-test'].style.pointerEvents).toBeUndefined()
  })

  it('отсекает detached-заглушку мёртвой карты и не трогает её стили', () => {
    const map = makeMap({ getOrCreate: true, connected: false })

    // Вторая ловушка патча: на пересоздаваемой карте возвращается узел вне
    // документа. Слой на нём просто исчезнет — потребитель должен узнать это по
    // `undefined` и остаться в штатном pane Leaflet.
    expect(ensureMapPane(map, 'metravel-test', { zIndex: 625 })).toBeUndefined()
    expect(map.panes['metravel-test'].style.zIndex).toBeUndefined()
  })

  it('не стилизует контейнер карты и общий mapPane после map.remove()', () => {
    // Третья ловушка патча: `Map.remove()` обнуляет `_panes`/`_mapPane`, и
    // leafletFix.ts:89-90 отдаёт уже не заглушку, а ЖИВОЙ узел — контейнер
    // карты или общий mapPane. `isConnected` их не отсекает, а
    // `pointer-events: none` на них убивает интерактивность всей карты
    // (и следующей, если react-leaflet переиспользует тот же контейнер).
    const container = { style: {} as Record<string, string>, isConnected: true }
    const removed: any = {
      getContainer: () => container,
      getPane: jest.fn(() => container),
      createPane: jest.fn(),
    }

    expect(ensureMapPane(removed, 'metravel-test', { zIndex: 625, pointerEvents: 'none' })).toBeUndefined()
    expect(container.style.zIndex).toBeUndefined()
    expect(container.style.pointerEvents).toBeUndefined()

    const mapPane = { style: {} as Record<string, string>, isConnected: true }
    const dying: any = { _mapPane: mapPane, getPane: jest.fn(() => mapPane) }

    expect(ensureMapPane(dying, 'metravel-test', { zIndex: 625, pointerEvents: 'none' })).toBeUndefined()
    expect(mapPane.style.pointerEvents).toBeUndefined()
  })

  it('возвращает undefined, когда pane взять неоткуда или карта бросает', () => {
    expect(ensureMapPane(null, 'metravel-test', { zIndex: 1 })).toBeUndefined()
    expect(
      ensureMapPane(makeMap({ getOrCreate: false, hasGetPane: false, hasCreatePane: false }), 'metravel-test', {
        zIndex: 1,
      }),
    ).toBeUndefined()

    const throwing = {
      getPane: () => {
        throw new Error('map is being recreated')
      },
    }
    expect(ensureMapPane(throwing, 'metravel-test', { zIndex: 1 })).toBeUndefined()
  })
})
