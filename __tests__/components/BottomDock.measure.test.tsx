/**
 * #2161: на native док меряется целиком — с нижней safe-area (paddingBottom
 * обёртки). Этот замер — резерв useBottomChromeInset и отступ тостов; замер
 * одного ряда иконок давал на iPhone ~40 pt меньше реального дока.
 */
import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isSuperuser: false, logout: jest.fn() }),
}))

import BottomDock from '@/components/layout/BottomDock'

describe('BottomDock: замер высоты дока на native', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('высоту отдаёт обёртка дока, а не ряд иконок', () => {
    const onDockHeight = jest.fn()
    const { getByTestId } = render(<BottomDock onDockHeight={onDockHeight} />)

    expect(getByTestId('footer-dock-measure').props.onLayout).toBeUndefined()
    expect(typeof getByTestId('footer-dock-wrapper').props.onLayout).toBe('function')

    fireEvent(getByTestId('footer-dock-wrapper'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 89 } },
    })
    expect(onDockHeight).toHaveBeenLastCalledWith(89)
  })
})
