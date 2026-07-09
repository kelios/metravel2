import { Platform, Share } from 'react-native'

import { shareTravel } from '@/utils/shareTravel'

describe('shareTravel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform.OS as any) = 'android'
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shares the canonical /travels URL instead of the invalid singular route', async () => {
    await expect(
      shareTravel({
        id: 'naroch-route',
        title: 'Нарочь',
        description: 'Беларусь',
      }),
    ).resolves.toBe(true)

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Нарочь',
        message: expect.stringContaining('https://metravel.by/travels/naroch-route'),
      }),
      expect.any(Object),
    )
    expect(Share.share).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://metravel.by/travel/naroch-route'),
      }),
      expect.any(Object),
    )
  })

  it('does not open share sheet when travel id is empty', async () => {
    await expect(shareTravel({ id: '', title: 'Без id' })).resolves.toBe(false)
    expect(Share.share).not.toHaveBeenCalled()
  })
})
