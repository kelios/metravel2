// Регресс на баг «нельзя скачать офлайн-карту»: контрол просил фиксированный
// диапазон зумов z10–16 и гасил кнопку, если область не влезала в бюджет 4000
// тайлов. Каждый уровень зума даёт ×4 тайлов, поэтому один z16 — это ~75% объёма,
// и любая область крупнее пары кварталов уходила за лимит: обзор Кракова (~40 км)
// давал 30k+ тайлов. Теперь диапазон подбирается под область.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  downloadAsync: jest.fn(),
}))

import {
  enumerateTiles,
  estimateTiles,
  planOfflineZoomRange,
  type OfflineBBox,
} from '@/utils/mapTileCache'

// Бюджет и диапазон зумов контрола: MAX_TILES из useOfflineTileDownload,
// MIN_Z/MAX_Z из MapOfflineDownloadControl.
const MAX_TILES = 4000
const MIN_Z = 10
const MAX_Z = 16

// Видимая область телефона (390×760) на разных зумах вокруг Кракова.
const KRAKOW_OVERVIEW_Z10: OfflineBBox = {
  south: 49.7238,
  west: 19.6722,
  north: 50.3939,
  east: 20.2078,
}
const KRAKOW_STREET_Z14: OfflineBBox = {
  south: 50.0391,
  west: 19.9233,
  north: 50.0809,
  east: 19.9567,
}

const plan = (bbox: OfflineBBox) => planOfflineZoomRange(bbox, MIN_Z, MAX_Z, MAX_TILES)

describe('planOfflineZoomRange', () => {
  it('срезает детализацию вместо отказа на обзорной области города', () => {
    // Так выглядел баг: фиксированный z10–16 на этой области — далеко за бюджетом.
    expect(estimateTiles(KRAKOW_OVERVIEW_Z10, MIN_Z, MAX_Z)).toBeGreaterThan(MAX_TILES)

    const result = plan(KRAKOW_OVERVIEW_Z10)

    expect(result).not.toBeNull()
    expect(result!.tileCount).toBeLessThanOrEqual(MAX_TILES)
    expect(result!.minZ).toBe(MIN_Z)
    expect(result!.maxZ).toBeLessThan(MAX_Z)
  })

  it('оставляет полную детализацию, когда область и так влезает', () => {
    const result = plan(KRAKOW_STREET_Z14)

    expect(result).not.toBeNull()
    expect(result!.maxZ).toBe(MAX_Z)
    expect(result!.tileCount).toBeLessThanOrEqual(MAX_TILES)
  })

  it('берёт максимально возможный зум, а не первый попавшийся', () => {
    const result = plan(KRAKOW_OVERVIEW_Z10)!

    // Следующий уровень уже не влез бы — значит, выбран потолок, а не запас.
    expect(estimateTiles(KRAKOW_OVERVIEW_Z10, MIN_Z, result.maxZ + 1)).toBeGreaterThan(MAX_TILES)
  })

  it('держит бюджет на областях любого размера', () => {
    const spans = [0.02, 0.1, 0.5, 1, 3, 8]
    for (const span of spans) {
      const bbox: OfflineBBox = {
        south: 50.06 - span / 2,
        north: 50.06 + span / 2,
        west: 19.94 - span / 2,
        east: 19.94 + span / 2,
      }
      const result = plan(bbox)
      if (result) expect(result.tileCount).toBeLessThanOrEqual(MAX_TILES)
    }
  })

  it('отказывает, только когда не влезает даже базовый зум', () => {
    const halfWorld: OfflineBBox = { south: -60, west: -170, north: 70, east: 170 }

    expect(estimateTiles(halfWorld, MIN_Z, MIN_Z)).toBeGreaterThan(MAX_TILES)
    expect(plan(halfWorld)).toBeNull()
  })

  it('совпадает с фактическим перечислением тайлов', () => {
    // Расхождение оценки и enumerateTiles уронило бы саму загрузку: она сверяет
    // длину списка с MAX_TILES и уходит в state=error.
    const result = plan(KRAKOW_OVERVIEW_Z10)!
    const tiles = enumerateTiles(KRAKOW_OVERVIEW_Z10, result.minZ, result.maxZ)

    expect(tiles).toHaveLength(result.tileCount)
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES)
  })

  it('не выходит за переданные границы зумов', () => {
    const result = plan(KRAKOW_STREET_Z14)!

    expect(result.minZ).toBeGreaterThanOrEqual(MIN_Z)
    expect(result.maxZ).toBeLessThanOrEqual(MAX_Z)
  })
})
