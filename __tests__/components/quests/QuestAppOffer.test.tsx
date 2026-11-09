/**
 * #3220: the quest page offers the app in its own flow — before the start and on
 * the finale — on phone browsers only; the floating bar no longer covers a step.
 */
import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))
jest.mock('@/utils/openAppStoreListing', () => ({ openAppStoreListing: jest.fn() }))

import QuestAppOffer from '@/components/quests/QuestAppOffer'
import { sendAnalyticsEvent } from '@/utils/analytics'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

describe('QuestAppOffer (#3220)', () => {
  const setUserAgent = (value: string) => Object.defineProperty(window.navigator, 'userAgent', { configurable: true, get: () => value })
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
    ;(sendAnalyticsEvent as jest.Mock).mockClear()
  })
  afterEach(() => jest.restoreAllMocks())

  it.each(['quest_intro', 'quest_finale'] as const)('offers the app in the %s flow on a phone browser', async (placement) => {
    setUserAgent(IPHONE)
    const view = await render(<QuestAppOffer placement={placement} />)
    expect(view.getByTestId(`quest-app-offer-${placement}`)).toBeTruthy()
    expect(view.getByText('Квест удобнее проходить в приложении')).toBeTruthy()
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('QuestAppOffer_Shown', { platform: 'ios', placement })
    expect(sendAnalyticsEvent).not.toHaveBeenCalledWith('AppInstallBar_Shown', expect.anything())
    await fireEvent.press(view.getByTestId(`quest-app-offer-${placement}-stores-ios`))
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('QuestAppOffer_Click', { platform: 'ios', placement })
  })

  it('stays out of desktop browsers and the native app', async () => {
    setUserAgent(DESKTOP)
    const desktop = await render(<QuestAppOffer placement="quest_intro" />)
    expect(desktop.queryByTestId('quest-app-offer-quest_intro')).toBeNull()
    jest.replaceProperty(Platform, 'OS', 'ios')
    setUserAgent(IPHONE)
    const native = await render(<QuestAppOffer placement="quest_finale" />)
    expect(native.queryByTestId('quest-app-offer-quest_finale')).toBeNull()
  })
})
