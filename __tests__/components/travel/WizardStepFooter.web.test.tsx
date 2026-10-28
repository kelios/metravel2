import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { WizardStepFooter } from '@/components/travel/upsert/WizardStepFooter'

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: true, isTablet: false }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ label, ...props }: { label: string }) => (
      <Pressable {...props}><Text>{label}</Text></Pressable>
    ),
  }
})

describe('WizardStepFooter web chrome', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('keeps the mobile web primary action above the floating install and consent bars', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const view = await render(
      <WizardStepFooter
        onPrimary={() => undefined}
        primaryLabel="Далее: Маршрут (шаг 2 из 6)"
      />,
    )

    const style = StyleSheet.flatten(view.getByTestId('travel-wizard.step-footer').props.style)
    expect(style.marginBottom).toBe('calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)))')
  })

  it('does not reserve web chrome on native', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const view = await render(
      <WizardStepFooter
        onPrimary={() => undefined}
        primaryLabel="Далее: Маршрут (шаг 2 из 6)"
      />,
    )

    const style = StyleSheet.flatten(view.getByTestId('travel-wizard.step-footer').props.style)
    expect(style.marginBottom).toBeUndefined()
  })
})
