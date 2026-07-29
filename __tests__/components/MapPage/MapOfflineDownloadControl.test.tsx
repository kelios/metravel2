// Регресс на баг «человек не может скачать офлайн-карту»: кнопка «Скачать эту
// область» гасла на любой области крупнее пары кварталов, потому что контрол
// всегда просил фиксированный z10–16 и упирался в бюджет 4000 тайлов. Проверяем
// связку контрол ↔ хук ↔ планировщик зумов на видимом поведении.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn().mockResolvedValue({ status: 200 }),
}))

jest.mock('@/utils/mapTileCache', () => {
  const actual = jest.requireActual('@/utils/mapTileCache')
  return {
    ...actual,
    listRegions: jest.fn().mockResolvedValue([]),
    deleteRegion: jest.fn().mockResolvedValue(undefined),
    downloadTileToDisk: jest.fn().mockResolvedValue(1024),
    registerRegion: jest.fn().mockResolvedValue(undefined),
  }
})

jest.mock('@/api/mapOffline', () => ({
  fetchOfflineMapPoints: jest.fn().mockResolvedValue({ points: [], etag: null }),
}))

jest.mock('@/services/offline/mapOfflineAdapter', () => ({
  buildMapRegionId: () => 'region-test',
  readMapRegionOffline: jest.fn().mockResolvedValue(null),
  saveMapRegionOffline: jest.fn().mockResolvedValue(undefined),
  deleteMapRegionOffline: jest.fn().mockResolvedValue(undefined),
}))

import { fireEvent, render, waitFor } from '@testing-library/react-native'
import React from 'react'

import MapOfflineDownloadControl from '@/components/MapPage/MapOfflineDownloadControl'
import type { OfflineBBox } from '@/utils/mapTileCache'

// Скриншот бага: обзор Кракова на телефоне (~40 км в ширину, зум карты ~10).
const OVERVIEW_BBOX: OfflineBBox = {
  south: 49.7238,
  west: 19.6722,
  north: 50.3939,
  east: 20.2078,
}
// Пара кварталов — единственное, что влезало в фиксированный z10–16.
const STREET_BBOX: OfflineBBox = {
  south: 50.0391,
  west: 19.9233,
  north: 50.0809,
  east: 19.9567,
}
const HALF_WORLD_BBOX: OfflineBBox = { south: -60, west: -170, north: 70, east: 170 }

const openSheet = (bbox: OfflineBBox | null) => {
  const view = render(<MapOfflineDownloadControl bbox={bbox} />)
  fireEvent.press(view.getByTestId('map-offline-download-fab'))
  return view
}

const submitDisabled = (view: ReturnType<typeof openSheet>) =>
  view.getByTestId('map-offline-download-submit').props.disabled

describe('MapOfflineDownloadControl', () => {
  it('разрешает скачать обзорную область города', async () => {
    const view = openSheet(OVERVIEW_BBOX)

    await waitFor(() => {
      expect(submitDisabled(view)).toBe(false)
    })
    expect(view.queryByTestId('map-offline-too-large')).toBeNull()
  })

  it('доводит скачивание обзорной области до реальной загрузки тайлов', async () => {
    // Главное доказательство фикса: раньше нажать было нельзя, а принудительный
    // запуск упал бы в state=error — список тайлов не влезал в MAX_TILES.
    const view = openSheet(OVERVIEW_BBOX)

    await waitFor(() => {
      expect(submitDisabled(view)).toBe(false)
    })
    fireEvent.press(view.getByTestId('map-offline-download-submit'))

    await waitFor(() => {
      expect(view.getByTestId('map-offline-cancel')).toBeTruthy()
    })
    fireEvent.press(view.getByTestId('map-offline-cancel'))
  })

  it('предупреждает, что у крупной области срезана детализация', async () => {
    const view = openSheet(OVERVIEW_BBOX)

    await waitFor(() => {
      expect(view.getByTestId('map-offline-reduced-detail')).toBeTruthy()
    })
  })

  it('держит оценку в пределах бюджета тайлов', async () => {
    const view = openSheet(OVERVIEW_BBOX)

    const estimate = await waitFor(() => view.getByTestId('map-offline-estimate'))
    const text = Array.isArray(estimate.props.children)
      ? estimate.props.children.join('')
      : String(estimate.props.children)
    const tiles = Number((text.match(/\d+/) ?? ['0'])[0])

    // До фикса тут было 32337 тайлов / 474 МБ и выключенная кнопка.
    expect(tiles).toBeGreaterThan(0)
    expect(tiles).toBeLessThanOrEqual(4000)
  })

  it('не срезает детализацию там, где она и так влезает', async () => {
    const view = openSheet(STREET_BBOX)

    await waitFor(() => {
      expect(submitDisabled(view)).toBe(false)
    })
    expect(view.queryByTestId('map-offline-reduced-detail')).toBeNull()
    expect(view.queryByTestId('map-offline-too-large')).toBeNull()
  })

  it('оставляет отказ только для областей, не влезающих даже на базовом зуме', async () => {
    const view = openSheet(HALF_WORLD_BBOX)

    await waitFor(() => {
      expect(view.getByTestId('map-offline-too-large')).toBeTruthy()
    })
    expect(submitDisabled(view)).toBe(true)
  })

  it('выключает кнопку, пока область карты неизвестна', async () => {
    const view = openSheet(null)

    await waitFor(() => {
      expect(submitDisabled(view)).toBe(true)
    })
  })
})
