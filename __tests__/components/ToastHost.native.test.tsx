/**
 * #2161 / #2168: тост на native целиком над доком. Отступ берётся из того же
 * резерва дока, что и у экранов (#2097), а док меряется целиком — вместе с
 * нижней safe-area, а не только рядом иконок.
 */
import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

import { BottomChromeInsetProvider } from '@/components/layout/bottomChromeInset'
import ToastHost from '@/components/ui/ToastHost'
import { TOAST_DOCK_GAP, showToast, toastBottomOffset } from '@/utils/toast.native'

const mockToastProps: Array<Record<string, unknown>> = []
const mockShow = jest.fn()
jest.mock('react-native-toast-message', () => {
  const ToastMock = (props: Record<string, unknown>) => {
    mockToastProps.push(props)
    return null
  }
  ToastMock.show = (...args: unknown[]) => mockShow(...args)
  ToastMock.hide = jest.fn()
  return {
    __esModule: true,
    default: ToastMock,
    BaseToast: () => null,
    ErrorToast: () => null,
    InfoToast: () => null,
    SuccessToast: () => null,
  }
})

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => mockInsets,
}))

const lastProps = () => mockToastProps.at(-1) ?? {}

describe('ToastHost (native)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    mockToastProps.length = 0
    mockShow.mockClear()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  })

  it('ставит тост над измеренным доком с зазором и по умолчанию снизу', () => {
    render(
      <BottomChromeInsetProvider measuredHeight={89}>
        <ToastHost />
      </BottomChromeInsetProvider>,
    )
    expect(lastProps()).toMatchObject({ position: 'bottom', bottomOffset: 89 + TOAST_DOCK_GAP })
  })

  it('до замера дока берёт тот же фолбэк, что экраны: док + нижняя safe-area', () => {
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 }
    render(<ToastHost />)
    expect(lastProps().bottomOffset).toBe(56 + 34 + TOAST_DOCK_GAP)
  })

  it('без дока и внутри полноэкранного Modal — над home indicator', () => {
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 }
    render(
      <BottomChromeInsetProvider measuredHeight={0}>
        <ToastHost />
      </BottomChromeInsetProvider>,
    )
    expect(lastProps().bottomOffset).toBe(34 + TOAST_DOCK_GAP)

    render(
      <BottomChromeInsetProvider measuredHeight={89}>
        <ToastHost overDock={false} />
      </BottomChromeInsetProvider>,
    )
    expect(lastProps().bottomOffset).toBe(34 + TOAST_DOCK_GAP)
  })

  it('слой тоста верхний и не перехватывает касания', () => {
    const { getByTestId } = render(<ToastHost />)
    const layer = getByTestId('toast-layer')
    expect(layer.props.pointerEvents).toBe('box-none')
    const flat = Array.isArray(layer.props.style) ? Object.assign({}, ...layer.props.style) : layer.props.style
    expect(flat.zIndex).toBeGreaterThan(0)
    expect(flat.elevation).toBeGreaterThan(0)
  })

  it('на web хоста нет — там свой ToastHost.web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const { toJSON } = render(<ToastHost />)
    expect(toJSON()).toBeNull()
  })
})

describe('toast.native: один источник отступа', () => {
  beforeEach(() => mockShow.mockClear())

  it('toastBottomOffset: док, иначе safe-area, плюс зазор', () => {
    expect(toastBottomOffset(89, 34)).toBe(89 + TOAST_DOCK_GAP)
    expect(toastBottomOffset(0, 34)).toBe(34 + TOAST_DOCK_GAP)
    expect(toastBottomOffset(0, Number.NaN)).toBe(TOAST_DOCK_GAP)
  })

  it('showToast не подставляет свой bottomOffset — отступ задаёт хост', async () => {
    await showToast({ type: 'success', text1: 'ok', position: 'bottom' })
    expect(mockShow).toHaveBeenCalledTimes(1)
    expect(mockShow.mock.calls[0][0]).not.toHaveProperty('bottomOffset')
  })

  it('кнопка действия доходит до хоста через props', async () => {
    const onPress = jest.fn()
    await showToast({ text1: 'ok', action: { label: 'Отменить', onPress } })
    expect(mockShow.mock.calls[0][0]).toMatchObject({ props: { action: { label: 'Отменить' } } })
  })
})
