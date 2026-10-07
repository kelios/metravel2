import { createRef } from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { MapOnboarding, restartMapOnboarding, getOnboardingSteps, getPhoneOnboardingSteps } from '@/components/MapPage/MapOnboarding'
import type { MapOnboardingTargetRegistry } from '@/components/MapPage/MapOnboarding'

let mockWindow = { width: 390, height: 844 }
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: { ...jest.requireActual('react-native').Platform, OS: 'ios' },
  useWindowDimensions: () => mockWindow,
}))
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => 'true'), setItem: jest.fn() }))
jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native')
  return { __esModule: true, default: ({ label, ...props }: any) => <Pressable {...props}><Text>{label}</Text></Pressable> }
})

describe('native target measurements (#2307)', () => {
  beforeEach(() => {
    jest.useFakeTimers(); mockWindow = { width: 390, height: 844 }
    // Override the hook actually cached by setup.ts, not a later mock factory.
    jest.mocked(useWindowDimensions).mockImplementation(() => ({ ...mockWindow, scale: 1, fontScale: 1 }))
    jest.spyOn((View as any).prototype, 'measureInWindow').mockImplementation((callback: any) => callback(0, 64, mockWindow.width, mockWindow.height - 64))
  })
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); jest.restoreAllMocks() })

  it.each(['phone', 'desktop'] as const)('measures native %s refs for steps2–4, subtracts overlay once, remeasures orientation and clears', async layout => {
    const steps = layout === 'phone' ? getPhoneOnboardingSteps() : getOnboardingSteps()
    let targetY = 730
    const registry: Record<string, any> = {}
    for (const step of steps) if (step.targetTestID) {
      registry[step.targetTestID] = { current: { measureInWindow: jest.fn(callback => callback(24, targetY, 44, 44)) } }
    }
    const view = render(<MapOnboarding layout={layout} targetRegistry={registry as MapOnboardingTargetRegistry} />)
    await act(async () => { restartMapOnboarding(); await Promise.resolve() })
    expect(view.queryByTestId('onboarding-spotlight')).toBeNull()
    fireEvent(view.getByTestId('onboarding-card'), 'layout', { nativeEvent: { layout: { height: 220 } } })
    for (let i = 1; i <= 3; i++) {
      fireEvent.press(view.getByTestId('onboarding-next'))
      act(() => jest.advanceTimersByTime(20))
      const spotlight = StyleSheet.flatten(view.getByTestId('onboarding-spotlight').props.style)
      expect(spotlight).toMatchObject({ top: targetY - 64 - 4, left: 20, width: 52, height: 52 })
      expect(registry[steps[i].targetTestID!].current.measureInWindow).toHaveBeenCalled()
      const card = StyleSheet.flatten(view.getByTestId('onboarding-card').props.style)
      expect(card.top + 220).toBeLessThanOrEqual(spotlight.top)
    }
    mockWindow = { width: 844, height: 390 }
    targetY = 120
    expect(useWindowDimensions()).toMatchObject({ width: 844, height: 390 })
    view.rerender(<MapOnboarding layout={layout} targetRegistry={registry} />)
    act(() => jest.advanceTimersByTime(20))
    expect(StyleSheet.flatten(view.getByTestId('onboarding-spotlight').props.style).top).toBe(52)
    fireEvent.press(view.getByTestId('onboarding-next'))
    expect(view.queryByTestId('onboarding-card')).toBeNull()
    expect(view.queryByTestId('onboarding-spotlight')).toBeNull()
  })

  it('ignores a late measurement from the previous step after orientation and step change', async () => {
    let delayed!: (...rect: number[]) => void
    const registry: MapOnboardingTargetRegistry = {
      'map-mobile-filters-button': { current: { measureInWindow: (callback: any) => { delayed = callback } } as View },
      'map-mobile-open-list': { current: { measureInWindow: (callback: any) => callback(40, 180, 44, 44) } as View },
    }
    const view = render(<MapOnboarding layout="phone" targetRegistry={registry} />)
    await act(async () => restartMapOnboarding())
    fireEvent.press(view.getByTestId('onboarding-next'))
    act(() => jest.advanceTimersByTime(20))
    fireEvent.press(view.getByTestId('onboarding-next'))
    act(() => jest.advanceTimersByTime(20))
    act(() => delayed(24, 730, 44, 44))
    expect(StyleSheet.flatten(view.getByTestId('onboarding-spotlight').props.style).top).toBe(112)
    view.unmount()
    act(() => delayed(24, 730, 44, 44))
  })

  it('a missing native target never draws an invented spotlight', async () => {
    const ref = createRef<View>()
    const view = render(<MapOnboarding layout="phone" targetRegistry={{ 'map-mobile-filters-button': ref }} />)
    await act(async () => restartMapOnboarding())
    fireEvent.press(view.getByTestId('onboarding-next'))
    act(() => jest.advanceTimersByTime(20))
    expect(view.queryByTestId('onboarding-spotlight')).toBeNull()
  })
})
