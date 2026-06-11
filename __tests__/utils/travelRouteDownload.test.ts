import { Platform } from 'react-native'

import { downloadTravelRouteFile } from '@/utils/travelRouteDownload'

jest.mock('@/api/travelRoutes', () => ({
  downloadTravelRouteFileBlob: jest.fn(),
}))
jest.mock('@/utils/downloadUrlOnWeb', () => ({
  downloadBlobOnWeb: jest.fn(),
}))
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

const { downloadTravelRouteFileBlob } = require('@/api/travelRoutes')
const { downloadBlobOnWeb } = require('@/utils/downloadUrlOnWeb')
const FileSystem = require('expo-file-system')
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
