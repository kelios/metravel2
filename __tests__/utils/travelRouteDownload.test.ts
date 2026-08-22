import { Platform } from 'react-native'

import { downloadTravelRouteFile } from '@/utils/travelRouteDownload'

jest.mock('@/api/travelRoutes', () => ({
  downloadTravelRouteFileBlob: jest.fn(),
}))
// #1496: тот же модуль обслуживает исходный файл маршрута поездки.
jest.mock('@/api/plannedTripRoutes', () => ({
  downloadPlannedTripRouteFileBlob: jest.fn(),
}))
jest.mock('@/utils/downloadUrlOnWeb', () => ({
  downloadBlobOnWeb: jest.fn(),
}))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

const { downloadTravelRouteFileBlob } = require('@/api/travelRoutes')
const { downloadBlobOnWeb } = require('@/utils/downloadUrlOnWeb')
const FileSystem = require('expo-file-system/legacy')
const Sharing = require('expo-sharing')

describe('downloadTravelRouteFile (Android-bug 96 regression)', () => {
  const file = { id: 7, ext: 'gpx', original_name: 'route.gpx' }
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    downloadTravelRouteFileBlob.mockResolvedValue({
      text: '<gpx/>',
      contentType: 'application/gpx+xml',
      filename: 'route.gpx',
    })
  })

  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  it('web: downloads via Blob helper, never touches FileSystem/Sharing', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    downloadBlobOnWeb.mockReturnValue(true)

    const started = await downloadTravelRouteFile(123, file)

    expect(downloadTravelRouteFileBlob).toHaveBeenCalledWith(123, 7)
    expect(downloadBlobOnWeb).toHaveBeenCalledTimes(1)
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled()
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
    expect(started).toBe(true)
  })

  it('android: writes to cache + shares natively — no Blob, no external URL', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    Sharing.isAvailableAsync.mockResolvedValue(true)

    const started = await downloadTravelRouteFile(123, file)

    // авторизованный download через apiClient (Token), затем нативное сохранение
    expect(downloadTravelRouteFileBlob).toHaveBeenCalledWith(123, 7)
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/route.gpx', '<gpx/>')
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/route.gpx',
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    )
    expect(downloadBlobOnWeb).not.toHaveBeenCalled()
    expect(started).toBe(true)
  })

  it('android: returns false when Sharing is unavailable', async () => {
    ;(Platform as { OS: string }).OS = 'ios'
    Sharing.isAvailableAsync.mockResolvedValue(false)

    const started = await downloadTravelRouteFile(123, file)

    expect(started).toBe(false)
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
  })
})

// #1496 — исходный файл маршрута запланированной поездки идёт тем же путём
// сохранения (web: Blob, native: cache + share), но берёт байты из хранилища
// поездки, а не путешествия.
describe('downloadPlannedTripRouteFile (#1496)', () => {
  const file = { id: 42, ext: 'gpx', original_name: 'tatry.gpx' }
  const originalOS = Platform.OS
  const { downloadPlannedTripRouteFileBlob } = require('@/api/plannedTripRoutes')
  const { downloadPlannedTripRouteFile } = require('@/utils/travelRouteDownload')

  beforeEach(() => {
    jest.clearAllMocks()
    downloadPlannedTripRouteFileBlob.mockResolvedValue({
      text: '<gpx/>',
      contentType: 'application/gpx+xml',
      filename: 'tatry.gpx',
    })
  })

  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  it('web: тянет байты из хранилища поездки и сохраняет их как есть', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    downloadBlobOnWeb.mockReturnValue(true)

    await expect(downloadPlannedTripRouteFile(7, file)).resolves.toBe(true)

    expect(downloadPlannedTripRouteFileBlob).toHaveBeenCalledWith(7, 42)
    expect(downloadTravelRouteFileBlob).not.toHaveBeenCalled()
    expect(downloadBlobOnWeb).toHaveBeenCalledWith(expect.any(Blob), 'tatry.gpx')
  })

  it('web: сохраняет BOM и исходные байты без decode/encode', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    downloadBlobOnWeb.mockReturnValue(true)
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x67, 0x70, 0x78, 0x2f, 0x3e])
    const originalBlob = new Blob([bytes])
    downloadPlannedTripRouteFileBlob.mockResolvedValue({
      text: '<gpx/>',
      blob: originalBlob,
      filename: 'tatry.gpx',
    })

    await downloadPlannedTripRouteFile(7, file)

    // Тот же объект означает, что путь не декодировал и не пересобирал bytes.
    expect(downloadBlobOnWeb).toHaveBeenCalledWith(originalBlob, 'tatry.gpx')
  })

  it('native: пишет в cache и отдаёт системному share-листу', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    Sharing.isAvailableAsync.mockResolvedValue(true)

    await expect(downloadPlannedTripRouteFile(7, file)).resolves.toBe(true)

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/tatry.gpx', '<gpx/>')
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/tatry.gpx',
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    )
  })

  it('native: пишет исходные байты как base64, не перекодируя текст', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    Sharing.isAvailableAsync.mockResolvedValue(true)
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x67, 0x70, 0x78, 0x2f, 0x3e])
    downloadPlannedTripRouteFileBlob.mockResolvedValue({
      text: '<gpx/>',
      bytes: bytes.buffer,
      filename: 'tatry.gpx',
    })

    await downloadPlannedTripRouteFile(7, file)

    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/tatry.gpx',
      btoa(binary),
      { encoding: 'base64' },
    )
  })

  it('падает на имя из метаданных, когда сервер не прислал filename', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    downloadBlobOnWeb.mockReturnValue(true)
    downloadPlannedTripRouteFileBlob.mockResolvedValue({ text: '<gpx/>' })

    await downloadPlannedTripRouteFile(7, { id: 42, ext: null, original_name: null })

    expect(downloadBlobOnWeb).toHaveBeenCalledWith(expect.any(Blob), 'route-42.gpx')
  })
})
